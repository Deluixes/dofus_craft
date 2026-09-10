import type { KrosmargeDB } from './db'
import type { PriceBook, PriceEntry, FreshnessConfig } from '../domain/types'
import type { Trade } from '../domain/trade'
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

/**
 * Les mouvements d'une ligne — mises en vente et ventes — sont des tableaux
 * embarqués, jamais des tables séparées : ils ne sont jamais interrogés
 * indépendamment de leur ligne. Toute modification réécrit donc la ligne
 * entière, ce qui rend chaque écriture atomique sans transaction explicite.
 */
export interface TradeRepository {
  add(trade: Trade): Promise<number>
  all(): Promise<Trade[]>
  save(trade: Trade): Promise<void>
  remove(id: number): Promise<void>
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

export function makeTradeRepository(db: KrosmargeDB): TradeRepository {
  return {
    async add(trade) { return db.trades.add(trade) },
    async all() { return db.trades.toArray() },
    async save(trade) {
      if (trade.id === undefined) throw new Error('Ligne sans identifiant : utiliser add')
      await db.trades.put(trade)
    },
    async remove(id) { await db.trades.delete(id) },
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
