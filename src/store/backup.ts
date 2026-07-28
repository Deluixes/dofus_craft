import type { KrosmargeDB, CurrentPriceRow, PriceHistoryRow } from './db'
import type { Sale } from '../domain/sale'
import type { AppSettings } from './repositories'

export const BACKUP_VERSION = 1

export interface BackupPayload {
  version: number
  currentPrices: CurrentPriceRow[]
  priceHistory: PriceHistoryRow[]
  sales: Sale[]
  settings: AppSettings
}

export async function exportBackup(db: KrosmargeDB): Promise<BackupPayload> {
  const [currentPrices, priceHistory, sales, settingsRow] = await Promise.all([
    db.currentPrices.toArray(),
    db.priceHistory.toArray(),
    db.sales.toArray(),
    db.settings.get('app'),
  ])
  return {
    version: BACKUP_VERSION,
    currentPrices,
    priceHistory,
    sales,
    settings: (settingsRow?.value ?? {}) as AppSettings,
  }
}

/**
 * Restauration destructive : le contenu existant est remplacé. Les relevés de
 * prix représentent l'investissement du joueur dans l'outil, l'interface doit
 * donc demander confirmation avant d'appeler cette fonction.
 */
export async function importBackup(db: KrosmargeDB, payload: BackupPayload): Promise<void> {
  if (payload.version !== BACKUP_VERSION) {
    throw new Error(`Version de sauvegarde non prise en charge : ${payload.version}`)
  }
  await db.transaction('rw', db.currentPrices, db.priceHistory, db.sales, db.settings, async () => {
    await Promise.all([db.currentPrices.clear(), db.priceHistory.clear(), db.sales.clear(), db.settings.clear()])
    await db.currentPrices.bulkAdd(payload.currentPrices)
    await db.priceHistory.bulkAdd(payload.priceHistory)
    await db.sales.bulkAdd(payload.sales)
    await db.settings.put({ key: 'app', value: payload.settings })
  })
}
