import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { KrosmargeDB } from './db'
import { exportBackup, importBackup, BACKUP_VERSION } from './backup'
import { makePriceRepository, makeSettingsRepository, DEFAULT_SETTINGS } from './repositories'

let db: KrosmargeDB
let seq = 0

beforeEach(async () => {
  db = new KrosmargeDB(`backup-${seq++}`)
  await db.open()
})

describe('exportBackup', () => {
  it('exporte prix, ventes et réglages avec un numéro de version', async () => {
    await makePriceRepository(db).record({ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 })
    const payload = await exportBackup(db)
    expect(payload.version).toBe(BACKUP_VERSION)
    expect(payload.currentPrices).toHaveLength(1)
  })
})

describe('importBackup', () => {
  it('restaure les prix dans une base vide', async () => {
    await importBackup(db, {
      version: BACKUP_VERSION,
      currentPrices: [{ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 }],
      priceHistory: [], sales: [], settings: DEFAULT_SETTINGS,
    })
    expect((await makePriceRepository(db).loadPriceBook()).get(5)?.kamas).toBe(100)
  })

  it('remplace intégralement le contenu existant', async () => {
    await makePriceRepository(db).record({ itemId: 9, kamas: 999, lotSize: 1, observedAt: 1 })
    await importBackup(db, {
      version: BACKUP_VERSION,
      currentPrices: [{ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 }],
      priceHistory: [], sales: [], settings: DEFAULT_SETTINGS,
    })
    const book = await makePriceRepository(db).loadPriceBook()
    expect(book.has(9)).toBe(false)
    expect(book.has(5)).toBe(true)
  })

  it('refuse une sauvegarde de version inconnue', async () => {
    await expect(importBackup(db, {
      version: 999, currentPrices: [], priceHistory: [], sales: [], settings: DEFAULT_SETTINGS,
    })).rejects.toThrow(/version/i)
  })

  it('restaure les réglages', async () => {
    await importBackup(db, {
      version: BACKUP_VERSION, currentPrices: [], priceHistory: [], sales: [],
      settings: { ...DEFAULT_SETTINGS, jobLevels: { forgeron: 77 } },
    })
    expect((await makeSettingsRepository(db).load()).jobLevels).toEqual({ forgeron: 77 })
  })
})
