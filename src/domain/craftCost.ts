import type { Recipe } from '../catalog/types'
import { unitPrice } from './price'
import type { PriceBook } from './types'

export interface CostLine {
  itemId: number
  quantity: number
  unitPrice: number | null
  subtotal: number | null
}

export interface CraftCost {
  /** `null` si et seulement si `missingItemIds` n'est pas vide. */
  total: number | null
  lines: CostLine[]
  missingItemIds: number[]
}

/**
 * Coût de production d'un craft.
 *
 * Un seul ingrédient sans prix rend le total indéfini : la spec interdit
 * d'estimer silencieusement une valeur manquante. Les lignes incomplètes
 * sont néanmoins conservées, l'interface s'en sert pour proposer la saisie.
 */
export function craftCost(recipe: Recipe, prices: PriceBook): CraftCost {
  const lines: CostLine[] = []
  const missingItemIds: number[] = []
  let total = 0

  for (const ing of recipe.ingredients) {
    const entry = prices.get(ing.itemId)
    if (!entry) {
      missingItemIds.push(ing.itemId)
      lines.push({ itemId: ing.itemId, quantity: ing.quantity, unitPrice: null, subtotal: null })
      continue
    }
    const unit = unitPrice(entry)
    const subtotal = unit * ing.quantity
    total += subtotal
    lines.push({ itemId: ing.itemId, quantity: ing.quantity, unitPrice: unit, subtotal })
  }

  return { total: missingItemIds.length > 0 ? null : total, lines, missingItemIds }
}
