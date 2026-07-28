import { describe, it, expect } from 'vitest'
import { freshnessOf, worstFreshness, DEFAULT_FRESHNESS, HOUR_MS } from './freshness'
import type { PriceEntry } from './types'

const NOW = 1_000_000_000_000
const agedBy = (hours: number): PriceEntry =>
  ({ itemId: 1, kamas: 100, lotSize: 1, observedAt: NOW - hours * HOUR_MS })

describe('freshnessOf', () => {
  it('utilise 24 h et 72 h par défaut', () => {
    expect(DEFAULT_FRESHNESS).toEqual({ freshHours: 24, staleHours: 72 })
  })

  it('classe frais en deçà de 24 h', () => {
    expect(freshnessOf(agedBy(0), NOW)).toBe('fresh')
    expect(freshnessOf(agedBy(23.9), NOW)).toBe('fresh')
  })

  it('classe acceptable entre 24 h et 72 h', () => {
    expect(freshnessOf(agedBy(24), NOW)).toBe('stale')
    expect(freshnessOf(agedBy(71.9), NOW)).toBe('stale')
  })

  it('classe périmé au-delà de 72 h', () => {
    expect(freshnessOf(agedBy(72), NOW)).toBe('expired')
    expect(freshnessOf(agedBy(500), NOW)).toBe('expired')
  })

  it('classe manquant en labsence de relevé', () => {
    expect(freshnessOf(undefined, NOW)).toBe('missing')
  })

  it('respecte des seuils personnalisés', () => {
    expect(freshnessOf(agedBy(2), NOW, { freshHours: 1, staleHours: 3 })).toBe('stale')
  })
})

describe('worstFreshness', () => {
  it('retient le niveau le plus dégradé', () => {
    expect(worstFreshness(['fresh', 'stale', 'fresh'])).toBe('stale')
    expect(worstFreshness(['fresh', 'expired', 'stale'])).toBe('expired')
    expect(worstFreshness(['expired', 'missing'])).toBe('missing')
  })

  it('renvoie frais quand tout est frais', () => {
    expect(worstFreshness(['fresh', 'fresh'])).toBe('fresh')
  })

  it('renvoie frais pour une liste vide', () => {
    expect(worstFreshness([])).toBe('fresh')
  })
})
