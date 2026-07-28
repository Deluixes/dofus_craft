import type { CatalogIndex, Job } from '../catalog/types'
import { craftCost, type CostLine } from './craftCost'
import { DEFAULT_FRESHNESS, freshnessOf, worstFreshness } from './freshness'
import { craftMargin, type CraftMargin } from './margin'
import { unitPrice } from './price'
import { canCraft, type JobLevels } from './surveyPriority'
import type { Freshness, FreshnessConfig, PriceBook } from './types'

export interface RankedCraft {
  resultItemId: number
  job: Job
  cost: number | null
  salePrice: number | null
  margin: CraftMargin | null
  confidence: Freshness
  lines: CostLine[]
  missingItemIds: number[]
}

/**
 * Sépare les crafts calculables des autres. Un craft dont un prix manque n'est
 * jamais classé avec une valeur estimée : il part dans `incomplete`, où
 * l'interface propose de compléter les relevés.
 */
export function rankCrafts(
  index: CatalogIndex,
  prices: PriceBook,
  jobLevels: JobLevels,
  now: number,
  cfg: FreshnessConfig = DEFAULT_FRESHNESS,
): { ranked: RankedCraft[]; incomplete: RankedCraft[] } {
  const ranked: RankedCraft[] = []
  const incomplete: RankedCraft[] = []

  for (const recipe of index.recipeByResultId.values()) {
    if (!canCraft(recipe, index, jobLevels)) continue

    const cost = craftCost(recipe, prices)
    const saleEntry = prices.get(recipe.resultItemId)
    const salePrice = saleEntry ? unitPrice(saleEntry) : null

    const missingItemIds = [...cost.missingItemIds]
    if (!saleEntry) missingItemIds.push(recipe.resultItemId)

    const confidence = worstFreshness([
      ...recipe.ingredients.map((i) => freshnessOf(prices.get(i.itemId), now, cfg)),
      freshnessOf(saleEntry, now, cfg),
    ])

    const entry: RankedCraft = {
      resultItemId: recipe.resultItemId,
      job: recipe.job,
      cost: cost.total,
      salePrice,
      margin: cost.total !== null && salePrice !== null ? craftMargin(cost.total, salePrice) : null,
      confidence,
      lines: cost.lines,
      missingItemIds,
    }

    if (entry.margin) ranked.push(entry)
    else incomplete.push(entry)
  }

  ranked.sort((a, b) => b.margin!.net - a.margin!.net)
  return { ranked, incomplete }
}
