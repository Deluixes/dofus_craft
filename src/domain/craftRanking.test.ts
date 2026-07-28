import { describe, it, expect } from 'vitest'
import { rankCrafts } from './craftRanking'
import { buildCatalogIndex } from '../catalog/loadCatalog'
import { HOUR_MS } from './freshness'
import type { Catalog } from '../catalog/types'
import type { PriceBook } from './types'

const NOW = 1_000_000_000_000

const catalog: Catalog = {
  version: 't',
  items: [
    { id: 1, name: 'Chapeau', type: 'Chapeau', level: 10, imgUrl: '', stats: [] },
    { id: 2, name: 'Cuir', type: 'Peau', level: 1, imgUrl: '', stats: [] },
    { id: 4, name: 'Cape', type: 'Cape', level: 10, imgUrl: '', stats: [] },
    { id: 5, name: 'Soie', type: 'Étoffe', level: 1, imgUrl: '', stats: [] },
  ],
  recipes: [
    { resultItemId: 1, job: 'tailleur', ingredients: [{ itemId: 2, quantity: 10 }] },
    { resultItemId: 4, job: 'tailleur', ingredients: [{ itemId: 5, quantity: 10 }] },
  ],
}
const index = buildCatalogIndex(catalog)

const at = (itemId: number, kamas: number, ageHours = 0) =>
  [itemId, { itemId, kamas, lotSize: 1 as const, observedAt: NOW - ageHours * HOUR_MS }] as const

describe('rankCrafts', () => {
  it('classe par marge nette décroissante', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000), at(5, 100), at(4, 2000)])
    const { ranked } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    expect(ranked.map((r) => r.resultItemId)).toEqual([1, 4])
  })

  it('calcule la marge en déduisant la taxe de 2 pourcent', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000)])
    const { ranked } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    // coût 1000, vente 5000, taxe 100 → 3900
    expect(ranked[0].margin?.net).toBe(3900)
  })

  it('sépare les crafts incalculables au lieu de les classer', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000)])
    const { ranked, incomplete } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    expect(ranked.map((r) => r.resultItemId)).toEqual([1])
    expect(incomplete.map((r) => r.resultItemId)).toEqual([4])
    expect(incomplete[0].margin).toBeNull()
  })

  it('signale les objets dont le prix manque', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000)])
    const { incomplete } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    expect(incomplete[0].missingItemIds).toEqual([5, 4])
  })

  it('propage la fraîcheur la plus dégradée au craft', () => {
    const prices: PriceBook = new Map([at(2, 100, 100), at(1, 5000, 1)])
    const { ranked } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    expect(ranked[0].confidence).toBe('expired')
  })

  it('exclut les recettes hors niveau de métier', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000), at(5, 100), at(4, 2000)])
    const { ranked, incomplete } = rankCrafts(index, prices, { tailleur: 9 }, NOW)
    expect(ranked).toHaveLength(0)
    expect(incomplete).toHaveLength(0)
  })
})
