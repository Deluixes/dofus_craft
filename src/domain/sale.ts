import { saleTax } from './margin'
import type { LotSize } from './types'
import { HOUR_MS } from './freshness'

/** Durée de mise en vente à l'HDV Dofus Touch. */
export const SALE_DURATION_MS = 14 * 24 * 60 * 60 * 1000

export type SaleStatus = 'listed' | 'sold' | 'returned'

/**
 * Sémantique de `quantity` et `lotSize`, fixée une fois pour toutes.
 *
 * `quantity` est un **nombre de lots**, pas un nombre d'unités : à l'HDV on met
 * des lots en vente, pas des objets. Le nombre d'unités réellement engagées
 * vaut donc `quantity × lotSize`, ce que calcule `unitsSold`. `unitPrice` et
 * `frozenCraftCost` restent, eux, exprimés à l'unité.
 */
export function unitsSold(sale: Pick<Sale, 'quantity' | 'lotSize'>): number {
  return sale.quantity * sale.lotSize
}

export interface Sale {
  id?: number
  itemId: number
  /** Nombre de **lots** mis en vente. Voir `unitsSold`. */
  quantity: number
  lotSize: LotSize
  unitPrice: number
  listedAt: number
  expiresAt: number
  status: SaleStatus
  closedAt?: number
  /** Coût unitaire de production figé à la mise en vente. */
  frozenCraftCost: number
}

export interface NewSaleInput {
  itemId: number
  quantity: number
  lotSize: LotSize
  unitPrice: number
  frozenCraftCost: number
}

export function createSale(input: NewSaleInput, listedAt: number): Sale {
  return { ...input, listedAt, expiresAt: listedAt + SALE_DURATION_MS, status: 'listed' }
}

export function isExpired(sale: Sale, now: number): boolean {
  return now >= sale.expiresAt
}

export function hoursUntilExpiry(sale: Sale, now: number): number {
  return Math.max(0, (sale.expiresAt - now) / HOUR_MS)
}

/**
 * Profit réel d'une vente, calculé sur le coût figé à la mise en vente et non
 * sur les prix courants : recalculer un profit passé avec les prix
 * d'aujourd'hui donnerait un chiffre faux.
 *
 * Le profit unitaire est multiplié par le nombre d'**unités** (`unitsSold`) et
 * non par le nombre de lots : 5 lots de 100 rapportent cent fois ce que
 * rapportent 5 unités.
 */
export function realizedProfit(sale: Sale): number {
  return (sale.unitPrice - saleTax(sale.unitPrice) - sale.frozenCraftCost) * unitsSold(sale)
}

/** Kamas immobilisés dans les ventes en cours, coût unitaire × unités engagées. */
export function committedKamas(sales: Sale[]): number {
  return sales
    .filter((s) => s.status === 'listed')
    .reduce((sum, s) => sum + s.frozenCraftCost * unitsSold(s), 0)
}
