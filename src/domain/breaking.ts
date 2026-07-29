import type { RuneRef } from '../catalog/statWeights'
import type { StatRange } from '../catalog/types'
import { unitPrice } from './price'
import type { PriceBook } from './types'

export interface Jet { name: string; value: number }

export interface BreakingLine {
  statName: string
  jet: number
  runeItemId: number
  runeCount: number
  value: number | null
}

export interface BreakingEstimate {
  /** `null` si le prix d'au moins une rune utilisée est inconnu. */
  total: number | null
  lines: BreakingLine[]
  missingRuneItemIds: number[]
}

/** Jets par défaut d'un objet : moyenne des bornes du catalogue. */
export function averageJets(stats: StatRange[]): Jet[] {
  return stats.map((s) => ({ name: s.name, value: (s.min + s.max) / 2 }))
}

/**
 * Valeur estimée du brisage d'un objet.
 *
 * ESTIMATION. Le taux réel dépend de la puissance de brisage et du focus du
 * joueur, non modélisés. Les statistiques sans rune correspondante (PO,
 * Initiative…) ne sont pas brisables et sont ignorées sans être signalées
 * comme manquantes — à la différence d'une rune connue dont le prix n'a pas
 * encore été relevé.
 */
export function breakingValue(
  jets: Jet[],
  statWeights: Record<string, number>,
  runes: RuneRef[],
  prices: PriceBook,
  breakRate = 1,
): BreakingEstimate {
  const runeByStat = new Map(runes.filter((r) => r.runeItemId !== 0).map((r) => [r.statName, r]))
  const lines: BreakingLine[] = []
  const missingRuneItemIds: number[] = []
  let total = 0

  for (const jet of jets) {
    const rune = runeByStat.get(jet.name)
    const weight = statWeights[jet.name]
    if (!rune || weight === undefined || rune.runeWeight === 0) continue

    const runeCount = (jet.value * weight * breakRate) / rune.runeWeight
    const entry = prices.get(rune.runeItemId)
    if (!entry) {
      missingRuneItemIds.push(rune.runeItemId)
      lines.push({ statName: jet.name, jet: jet.value, runeItemId: rune.runeItemId, runeCount, value: null })
      continue
    }
    const value = runeCount * unitPrice(entry)
    total += value
    lines.push({ statName: jet.name, jet: jet.value, runeItemId: rune.runeItemId, runeCount, value })
  }

  return { total: missingRuneItemIds.length > 0 ? null : total, lines, missingRuneItemIds }
}
