import Dexie, { type Table } from 'dexie'
import type { LotSize } from '../domain/types'
import type { Sale } from '../domain/sale'

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
  sales!: Table<Sale, number>
  settings!: Table<SettingRow, string>

  constructor(name = 'krosmarge') {
    super(name)
    this.version(1).stores({
      currentPrices: 'itemId',
      priceHistory: '++id, itemId, observedAt',
      sales: '++id, itemId, status, expiresAt',
      settings: 'key',
    })
  }
}

export const db = new KrosmargeDB()
