import type { KrosmargeDB } from './db'
import type { PriceBook, PriceEntry, FreshnessConfig } from '../domain/types'
import type { Sale, SaleStatus } from '../domain/sale'
import type { JobLevels } from '../domain/surveyPriority'
import { DEFAULT_FRESHNESS } from '../domain/freshness'

export interface AppSettings {
  jobLevels: JobLevels
  freshness: FreshnessConfig
  runeItemIds: Record<string, number>
}

export const DEFAULT_SETTINGS: AppSettings = {
  jobLevels: {},
  freshness: DEFAULT_FRESHNESS,
  runeItemIds: {},
}

const SETTINGS_KEY = 'app'

export interface PriceRepository {
  record(entry: PriceEntry): Promise<void>
  loadPriceBook(): Promise<PriceBook>
  historyFor(itemId: number): Promise<PriceEntry[]>
}

export interface SaleRepository {
  add(sale: Sale): Promise<number>
  listed(): Promise<Sale[]>
  all(): Promise<Sale[]>
  close(id: number, status: SaleStatus, closedAt: number): Promise<void>
}

export interface SettingsRepository {
  load(): Promise<AppSettings>
  save(settings: AppSettings): Promise<void>
}

export function makePriceRepository(db: KrosmargeDB): PriceRepository {
  return {
    async record(entry) {
      await db.transaction('rw', db.currentPrices, db.priceHistory, async () => {
        await db.currentPrices.put(entry)
        await db.priceHistory.add({ ...entry })
      })
    },
    async loadPriceBook() {
      const rows = await db.currentPrices.toArray()
      return new Map(rows.map((row) => [row.itemId, row]))
    },
    async historyFor(itemId) {
      return db.priceHistory.where('itemId').equals(itemId).sortBy('observedAt')
    },
  }
}

export function makeSaleRepository(db: KrosmargeDB): SaleRepository {
  return {
    async add(sale) { return db.sales.add(sale) },
    async listed() { return db.sales.where('status').equals('listed').toArray() },
    async all() { return db.sales.toArray() },
    async close(id, status, closedAt) { await db.sales.update(id, { status, closedAt }) },
  }
}

export function makeSettingsRepository(db: KrosmargeDB): SettingsRepository {
  return {
    async load() {
      const row = await db.settings.get(SETTINGS_KEY)
      // Fusion avec les valeurs par défaut : un enregistrement issu d'une
      // version antérieure peut ne pas porter tous les champs.
      return { ...DEFAULT_SETTINGS, ...((row?.value ?? {}) as Partial<AppSettings>) }
    },
    async save(settings) {
      await db.settings.put({ key: SETTINGS_KEY, value: settings })
    },
  }
}
