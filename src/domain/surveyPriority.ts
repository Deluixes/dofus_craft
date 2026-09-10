import type { CatalogIndex, Job, Recipe } from '../catalog/types'
import { DEFAULT_FRESHNESS, HOUR_MS } from './freshness'
import { unitPrice } from './price'
import type { FreshnessConfig, PriceBook } from './types'

/**
 * Obsolescence forfaitaire d'un prix jamais relevé. Volontairement très
 * supérieure à 1 pour qu'un prix absent passe devant un prix simplement vieux.
 */
export const MISSING_OBSOLESCENCE = 10

export type JobLevels = Partial<Record<Job, number>>

export interface PriorityEntry {
  itemId: number
  impact: number
  obsolescence: number
  priority: number
  affectedRecipeCount: number
}

/** Règle Dofus : le niveau de métier doit atteindre le niveau de l'objet produit. */
export function canCraft(recipe: Recipe, index: CatalogIndex, jobLevels: JobLevels): boolean {
  const item = index.itemsById.get(recipe.resultItemId)
  if (!item) return false
  return (jobLevels[recipe.job] ?? 0) >= item.level
}

function obsolescenceOf(prices: PriceBook, itemId: number, now: number, cfg: FreshnessConfig): number {
  const entry = prices.get(itemId)
  if (!entry) return MISSING_OBSOLESCENCE
  return (now - entry.observedAt) / (cfg.staleHours * HOUR_MS)
}

/**
 * Ordonne les prix à relever.
 *
 * L'ensemble de référence est celui des recettes que les niveaux de métier
 * autorisent, et non celui des recettes rentables : au premier lancement
 * aucun prix n'est connu, donc aucune rentabilité n'est calculable, et fonder
 * l'impact sur elle produirait une file vide.
 *
 * Les objets résultat sont inclus avec un impact de 1 par recette : leur prix
 * de vente conditionne l'intégralité du calcul de marge.
 */
export function surveyPriority(
  index: CatalogIndex,
  prices: PriceBook,
  jobLevels: JobLevels,
  now: number,
  cfg: FreshnessConfig = DEFAULT_FRESHNESS,
): PriorityEntry[] {
  const impact = new Map<number, number>()
  const recipeCount = new Map<number, number>()

  /**
   * N'entre dans la file qu'un objet réellement présent au catalogue.
   *
   * Dix ingrédients du dataset Dofus Touch référencent un identifiant sans
   * objet correspondant — ils étaient 147 avant l'ajout des familiers et des
   * montures au catalogue. Un tel identifiant n'a ni nom ni image, ne peut donc
   * jamais être relevé, et son obsolescence reste bloquée à
   * `MISSING_OBSOLESCENCE` pendant que tous les prix relevés décroissent : il
   * remonte mécaniquement en tête de file session après session. Le filtrer
   * ici est la seule correction qui tienne dans la durée.
   */
  const bump = (itemId: number, share: number) => {
    if (!index.itemsById.has(itemId)) return
    impact.set(itemId, (impact.get(itemId) ?? 0) + share)
    recipeCount.set(itemId, (recipeCount.get(itemId) ?? 0) + 1)
  }

  for (const recipe of index.recipeByResultId.values()) {
    if (!canCraft(recipe, index, jobLevels)) continue

    const subtotals = recipe.ingredients.map((ing) => {
      const entry = prices.get(ing.itemId)
      return entry ? unitPrice(entry) * ing.quantity : null
    })
    const complete = subtotals.every((s) => s !== null)
    const total = complete ? subtotals.reduce((a, b) => a! + b!, 0)! : 0

    recipe.ingredients.forEach((ing, i) => {
      const share = complete && total > 0
        ? subtotals[i]! / total
        : 1 / recipe.ingredients.length
      bump(ing.itemId, share)
    })

    bump(recipe.resultItemId, 1)
  }

  const entries: PriorityEntry[] = []
  for (const [itemId, imp] of impact) {
    const obsolescence = obsolescenceOf(prices, itemId, now, cfg)
    entries.push({
      itemId,
      impact: imp,
      obsolescence,
      priority: imp * obsolescence,
      affectedRecipeCount: recipeCount.get(itemId) ?? 0,
    })
  }

  return entries.sort((a, b) => b.priority - a.priority)
}
