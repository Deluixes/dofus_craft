export type LotSize = 1 | 10 | 100

export interface PriceEntry {
  itemId: number
  kamas: number
  lotSize: LotSize
  observedAt: number
}

/** Dernier prix relevé, indexé par identifiant d'objet. */
export type PriceBook = Map<number, PriceEntry>

export type Freshness = 'fresh' | 'stale' | 'expired' | 'missing'

export interface FreshnessConfig {
  freshHours: number
  staleHours: number
}
