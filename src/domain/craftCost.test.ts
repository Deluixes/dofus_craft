import { describe, it, expect } from 'vitest'
import { craftCost } from './craftCost'
import type { PriceBook } from './types'
import type { Recipe } from '../catalog/types'

const recipe: Recipe = {
  resultItemId: 100,
  job: 'tailleur',
  ingredients: [{ itemId: 2, quantity: 3 }, { itemId: 3, quantity: 5 }],
}

const book = (entries: Array<[number, number, 1 | 10 | 100]>): PriceBook =>
  new Map(entries.map(([itemId, kamas, lotSize]) => [
    itemId, { itemId, kamas, lotSize, observedAt: 0 },
  ]))

describe('craftCost', () => {
  it('somme les sous-totaux quand tous les prix sont connus', () => {
    const result = craftCost(recipe, book([[2, 100, 1], [3, 5000, 100]]))
    // 3 × 100 + 5 × 50 = 550
    expect(result.total).toBe(550)
    expect(result.missingItemIds).toEqual([])
  })

  it('détaille chaque ligne avec son prix unitaire et son sous-total', () => {
    const result = craftCost(recipe, book([[2, 100, 1], [3, 5000, 100]]))
    expect(result.lines).toEqual([
      { itemId: 2, quantity: 3, unitPrice: 100, subtotal: 300 },
      { itemId: 3, quantity: 5, unitPrice: 50, subtotal: 250 },
    ])
  })

  it('rend le total indéfini dès quun seul prix manque', () => {
    const result = craftCost(recipe, book([[2, 100, 1]]))
    expect(result.total).toBeNull()
    expect(result.missingItemIds).toEqual([3])
  })

  it('liste tous les ingrédients manquants, pas seulement le premier', () => {
    const result = craftCost(recipe, book([]))
    expect(result.missingItemIds).toEqual([2, 3])
  })

  it('conserve les lignes des ingrédients sans prix pour permettre leur saisie', () => {
    const result = craftCost(recipe, book([[2, 100, 1]]))
    expect(result.lines[1]).toEqual({ itemId: 3, quantity: 5, unitPrice: null, subtotal: null })
  })

  it('renvoie un total nul pour une recette sans ingrédient', () => {
    const empty: Recipe = { resultItemId: 1, job: 'tailleur', ingredients: [] }
    expect(craftCost(empty, book([])).total).toBe(0)
  })
})
