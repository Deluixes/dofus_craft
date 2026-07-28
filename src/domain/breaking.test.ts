import { describe, it, expect } from 'vitest'
import { breakingValue, averageJets } from './breaking'
import type { RuneRef } from '../catalog/statWeights'
import type { PriceBook } from './types'

const weights = { 'Vitalité': 1, 'Force': 1, 'PO': 51 }
const runes: RuneRef[] = [
  { statName: 'Vitalité', runeItemId: 900, runeWeight: 1 },
  { statName: 'Force', runeItemId: 901, runeWeight: 1 },
]
const prices: PriceBook = new Map([
  [900, { itemId: 900, kamas: 10, lotSize: 1, observedAt: 0 }],
  [901, { itemId: 901, kamas: 200, lotSize: 1, observedAt: 0 }],
])

describe('averageJets', () => {
  it('prend la moyenne des bornes de chaque statistique', () => {
    expect(averageJets([{ name: 'Vitalité', min: 351, max: 400 }]))
      .toEqual([{ name: 'Vitalité', value: 375.5 }])
  })

  it('renvoie la valeur exacte quand les bornes sont égales', () => {
    expect(averageJets([{ name: 'PO', min: 1, max: 1 }]))
      .toEqual([{ name: 'PO', value: 1 }])
  })
})

describe('breakingValue', () => {
  it('valorise chaque statistique par sa rune', () => {
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, runes, prices)
    // 100 × poids 1 × taux 1 / poids rune 1 = 100 runes × 10 kamas
    expect(r.total).toBe(1000)
  })

  it('cumule plusieurs statistiques', () => {
    const r = breakingValue(
      [{ name: 'Vitalité', value: 100 }, { name: 'Force', value: 50 }],
      weights, runes, prices,
    )
    expect(r.total).toBe(1000 + 50 * 200)
  })

  it('applique le taux de brisage', () => {
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, runes, prices, 1.5)
    expect(r.total).toBe(1500)
  })

  it('ignore les statistiques sans rune correspondante', () => {
    // PO a un poids mais aucune rune : non brisable, pas un prix manquant.
    const r = breakingValue([{ name: 'PO', value: 1 }], weights, runes, prices)
    expect(r.total).toBe(0)
    expect(r.missingRuneItemIds).toEqual([])
  })

  it('ignore une rune dont lidentifiant nest pas renseigné', () => {
    const unresolved: RuneRef[] = [{ statName: 'Vitalité', runeItemId: 0, runeWeight: 1 }]
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, unresolved, prices)
    expect(r.total).toBe(0)
    expect(r.missingRuneItemIds).toEqual([])
  })

  it('rend le total indéfini quand le prix dune rune utilisée manque', () => {
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, runes, new Map())
    expect(r.total).toBeNull()
    expect(r.missingRuneItemIds).toEqual([900])
  })

  it('détaille le nombre de runes par statistique', () => {
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, runes, prices)
    expect(r.lines).toEqual([
      { statName: 'Vitalité', jet: 100, runeItemId: 900, runeCount: 100, value: 1000 },
    ])
  })
})
