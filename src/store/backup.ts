import type { KrosmargeDB, CurrentPriceRow, PriceHistoryRow } from './db'
import type { Trade } from '../domain/trade'
import type { AppSettings } from './repositories'
import { saleToTrade, type LegacySale } from './legacySale'

export const BACKUP_VERSION = 2

export interface BackupPayload {
  version: number
  currentPrices: CurrentPriceRow[]
  priceHistory: PriceHistoryRow[]
  trades: Trade[]
  settings: AppSettings
}

/**
 * Sauvegarde produite avant le registre de négoce. Elle reste lisible : un
 * fichier exporté hier ne doit pas devenir illisible demain, sans quoi la
 * sauvegarde ne protège de rien.
 */
export interface BackupPayloadV1 {
  version: 1
  currentPrices: CurrentPriceRow[]
  priceHistory: PriceHistoryRow[]
  sales: LegacySale[]
  settings: AppSettings
}

export async function exportBackup(db: KrosmargeDB): Promise<BackupPayload> {
  const [currentPrices, priceHistory, trades, settingsRow] = await Promise.all([
    db.currentPrices.toArray(),
    db.priceHistory.toArray(),
    db.trades.toArray(),
    db.settings.get('app'),
  ])
  return {
    version: BACKUP_VERSION,
    currentPrices,
    priceHistory,
    trades,
    settings: (settingsRow?.value ?? {}) as AppSettings,
  }
}

/**
 * Ramène n'importe quelle sauvegarde reconnue au format courant.
 *
 * Lève une erreur pour toute autre version, y compris une version FUTURE :
 * deviner la structure d'un format qu'on ne connaît pas produirait des chiffres
 * faux en silence, ce qui est pire que de refuser.
 */
export function migrateBackup(payload: BackupPayload | BackupPayloadV1): BackupPayload {
  if (payload.version === BACKUP_VERSION) return payload as BackupPayload

  if (payload.version === 1) {
    const v1 = payload as BackupPayloadV1
    return {
      version: BACKUP_VERSION,
      currentPrices: v1.currentPrices,
      priceHistory: v1.priceHistory,
      trades: (v1.sales ?? []).map(saleToTrade),
      settings: v1.settings,
    }
  }

  throw new Error(`Version de sauvegarde non prise en charge : ${payload.version}`)
}

/**
 * Restauration destructive : le contenu existant est remplacé. Les relevés de
 * prix représentent l'investissement du joueur dans l'outil, l'interface doit
 * donc demander confirmation avant d'appeler cette fonction.
 *
 * La conversion a lieu AVANT d'ouvrir la transaction : une sauvegarde refusée
 * ne doit rien effacer.
 */
export async function importBackup(
  db: KrosmargeDB,
  payload: BackupPayload | BackupPayloadV1,
): Promise<void> {
  const current = migrateBackup(payload)

  await db.transaction('rw', db.currentPrices, db.priceHistory, db.trades, db.settings, async () => {
    await Promise.all([
      db.currentPrices.clear(),
      db.priceHistory.clear(),
      db.trades.clear(),
      db.settings.clear(),
    ])
    await db.currentPrices.bulkAdd(current.currentPrices)
    await db.priceHistory.bulkAdd(current.priceHistory)
    // Les identifiants sont volontairement laissés tels quels : réimporter une
    // sauvegarde doit reproduire exactement l'état exporté, pas le renuméroter.
    await db.trades.bulkAdd(current.trades)
    await db.settings.put({ key: 'app', value: current.settings })
  })
}
