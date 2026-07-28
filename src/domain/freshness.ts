import type { Freshness, FreshnessConfig, PriceEntry } from './types'

export const HOUR_MS = 3_600_000

export const DEFAULT_FRESHNESS: FreshnessConfig = { freshHours: 24, staleHours: 72 }

export function freshnessOf(
  entry: PriceEntry | undefined,
  now: number,
  cfg: FreshnessConfig = DEFAULT_FRESHNESS,
): Freshness {
  if (!entry) return 'missing'
  const ageHours = (now - entry.observedAt) / HOUR_MS
  if (ageHours < cfg.freshHours) return 'fresh'
  if (ageHours < cfg.staleHours) return 'stale'
  return 'expired'
}

const RANK: Record<Freshness, number> = { fresh: 0, stale: 1, expired: 2, missing: 3 }

/**
 * Confiance d'un ensemble de prix : un craft n'est pas plus fiable que sa
 * donnée la plus faible. Une liste vide vaut `fresh`, cas qui ne se produit
 * pas en pratique (toute recette a au moins un ingrédient).
 */
export function worstFreshness(list: Freshness[]): Freshness {
  return list.reduce<Freshness>((worst, f) => (RANK[f] > RANK[worst] ? f : worst), 'fresh')
}
