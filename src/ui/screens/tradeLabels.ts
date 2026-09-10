import type { TradeStatus } from '../../domain/trade'

/**
 * Libellés des cinq états d'une opération.
 *
 * « Retiré » et « Vendu » sont volontairement distincts, et le vocabulaire ne
 * doit jamais les confondre : un objet retiré du HDV immobilise toujours ses
 * kamas, alors qu'un objet vendu les a libérés.
 */
export const STATUS_LABELS: Record<TradeStatus, string> = {
  inStock: 'en stock',
  listed: 'en vente',
  partiallySold: 'partiellement vendu',
  sold: 'vendu',
  withdrawn: 'retiré du HDV',
}

/** Regroupement de l'écran Négoce : ce qui bouge, ce qui dort, ce qui est clos. */
export const STATUS_GROUPS: Array<{ title: string; statuses: TradeStatus[] }> = [
  { title: 'En vente', statuses: ['listed', 'partiallySold'] },
  { title: 'En stock', statuses: ['inStock', 'withdrawn'] },
  { title: 'Historique', statuses: ['sold'] },
]
