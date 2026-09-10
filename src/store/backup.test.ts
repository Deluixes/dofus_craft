import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { KrosmargeDB } from './db'
import { exportBackup, importBackup, migrateBackup, BACKUP_VERSION, type BackupPayload } from './backup'
import { makePriceRepository, makeTradeRepository, makeSettingsRepository, DEFAULT_SETTINGS } from './repositories'
import type { Trade } from '../domain/trade'

let db: KrosmargeDB
let seq = 0

beforeEach(async () => {
  db = new KrosmargeDB(`backup-${seq++}`)
  await db.open()
})

const trade: Trade = {
  itemId: 42,
  origin: 'purchase',
  quantity: 100,
  unitCost: 500,
  acquiredAt: 1000,
  listings: [{ id: 'l1', at: 2000, unitPrice: 800, quantity: 100 }],
  sales: [{ id: 's1', at: 3000, unitPrice: 800, quantity: 60 }],
  createdAt: 1000,
}

function payload(over: Partial<BackupPayload> = {}): BackupPayload {
  return {
    version: BACKUP_VERSION,
    currentPrices: [],
    priceHistory: [],
    trades: [],
    settings: DEFAULT_SETTINGS,
    ...over,
  }
}

describe('exportBackup', () => {
  it('exporte prix, lignes de négoce et réglages avec un numéro de version', async () => {
    await makePriceRepository(db).record({ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 })
    await makeTradeRepository(db).add({ ...trade })

    const exported = await exportBackup(db)
    expect(exported.version).toBe(BACKUP_VERSION)
    expect(exported.currentPrices).toHaveLength(1)
    expect(exported.trades).toHaveLength(1)
  })
})

describe('importBackup', () => {
  it('restaure les prix dans une base vide', async () => {
    await importBackup(db, payload({
      currentPrices: [{ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 }],
    }))
    expect((await makePriceRepository(db).loadPriceBook()).get(5)?.kamas).toBe(100)
  })

  it('restaure les lignes de négoce avec leurs mouvements', async () => {
    await importBackup(db, payload({ trades: [{ ...trade }] }))
    const restored = (await makeTradeRepository(db).all())[0]
    expect(restored).toMatchObject({ itemId: 42, quantity: 100, unitCost: 500 })
    expect(restored.listings).toHaveLength(1)
    expect(restored.sales[0]).toMatchObject({ at: 3000, quantity: 60 })
  })

  it('remplace intégralement le contenu existant', async () => {
    await makePriceRepository(db).record({ itemId: 9, kamas: 999, lotSize: 1, observedAt: 1 })
    await makeTradeRepository(db).add({ ...trade, itemId: 9 })

    await importBackup(db, payload({
      currentPrices: [{ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 }],
    }))

    const book = await makePriceRepository(db).loadPriceBook()
    expect(book.has(9)).toBe(false)
    expect(book.has(5)).toBe(true)
    expect(await makeTradeRepository(db).all()).toHaveLength(0)
  })

  it('refuse une sauvegarde de version inconnue', async () => {
    await expect(importBackup(db, payload({ version: 999 }))).rejects.toThrow(/version/i)
  })

  it('ne détruit rien quand la version est refusée', async () => {
    /*
     * L'import est destructif : il vide les tables avant d'ecrire. C'est le seul
     * chemin capable d'effacer l'integralite des releves du joueur,
     * c'est-a-dire tout son investissement dans l'outil.
     */
    const prices = makePriceRepository(db)
    await prices.record({ itemId: 42, kamas: 7777, lotSize: 1, observedAt: 1000 })

    await expect(importBackup(db, payload({
      version: 999,
      currentPrices: [{ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 }],
    }))).rejects.toThrow(/version/i)

    expect((await prices.loadPriceBook()).get(42)?.kamas).toBe(7777)
  })

  it('restaure les réglages', async () => {
    await importBackup(db, payload({ settings: { ...DEFAULT_SETTINGS, jobLevels: { forgeron: 77 } } }))
    expect((await makeSettingsRepository(db).load()).jobLevels).toEqual({ forgeron: 77 })
  })

  it('rend un aller-retour export puis import fidèle', async () => {
    await makeTradeRepository(db).add({ ...trade })
    await makePriceRepository(db).record({ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 })
    const exported = await exportBackup(db)

    await importBackup(db, exported)
    expect(await exportBackup(db)).toEqual(exported)
  })
})

describe('migrateBackup — sauvegardes v1', () => {
  const v1 = {
    version: 1 as const,
    currentPrices: [{ itemId: 5, kamas: 100, lotSize: 1 as const, observedAt: 1000 }],
    priceHistory: [],
    sales: [{
      id: 3, itemId: 42, quantity: 5, lotSize: 10, unitPrice: 2000,
      listedAt: 1000, expiresAt: 99_000, status: 'sold' as const, closedAt: 50_000,
      frozenCraftCost: 1000,
    }],
    settings: DEFAULT_SETTINGS,
  }

  it('convertit les ventes en lignes de négoce', () => {
    const migrated = migrateBackup(v1)
    expect(migrated.version).toBe(BACKUP_VERSION)
    expect(migrated.trades).toHaveLength(1)
    expect(migrated.trades[0]).toMatchObject({ itemId: 42, quantity: 50, origin: 'craft' })
  })

  it('conserve les prix relevés, qui sont lessentiel du travail du joueur', () => {
    expect(migrateBackup(v1).currentPrices).toEqual(v1.currentPrices)
  })

  it('simporte réellement dans une base courante', async () => {
    await importBackup(db, v1)
    const trades = await makeTradeRepository(db).all()
    expect(trades).toHaveLength(1)
    expect(trades[0].sales[0]).toMatchObject({ at: 50_000, quantity: 50 })
  })

  it('supporte une sauvegarde v1 sans aucune vente', () => {
    expect(migrateBackup({ ...v1, sales: [] }).trades).toEqual([])
  })

  it('refuse une version future plutôt que den deviner la structure', () => {
    // Deviner produirait des chiffres faux en silence, ce qui est pire que refuser.
    expect(() => migrateBackup(payload({ version: 3 }))).toThrow(/version/i)
  })
})
