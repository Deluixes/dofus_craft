import Dexie, { type Table } from 'dexie'
import type { LotSize } from '../domain/types'
import type { Trade } from '../domain/trade'
import { saleToTrade, type LegacySale } from './legacySale'

export interface CurrentPriceRow {
  itemId: number
  kamas: number
  lotSize: LotSize
  observedAt: number
}

export interface PriceHistoryRow extends CurrentPriceRow { id?: number }

export interface SettingRow { key: string; value: unknown }

export class KrosmargeDB extends Dexie {
  currentPrices!: Table<CurrentPriceRow, number>
  priceHistory!: Table<PriceHistoryRow, number>
  trades!: Table<Trade, number>
  settings!: Table<SettingRow, string>

  constructor(name = 'krosmarge') {
    super(name)
    this.version(1).stores({
      currentPrices: 'itemId',
      priceHistory: '++id, itemId, observedAt',
      sales: '++id, itemId, status, expiresAt',
      settings: 'key',
    })

    /*
     * La table `sales` est conservée telle quelle dans cette version, et n'est
     * supprimée qu'à la suivante. C'est indispensable : Dexie applique le schéma
     * AVANT d'exécuter `upgrade`, donc déclarer `sales: null` ici effacerait les
     * ventes avant qu'on ait pu les lire.
     */
    this.version(2)
      .stores({ trades: '++id, itemId, acquiredAt' })
      .upgrade(async (tx) => {
        const legacy = (await tx.table('sales').toArray()) as LegacySale[]
        if (legacy.length === 0) return
        await tx.table('trades').bulkAdd(legacy.map(saleToTrade))
      })

    this.version(3).stores({ sales: null })
  }
}

export const db = new KrosmargeDB()
