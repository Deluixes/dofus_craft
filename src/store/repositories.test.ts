import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { KrosmargeDB } from './db'
import { makePriceRepository, makeTradeRepository, makeSettingsRepository, DEFAULT_SETTINGS } from './repositories'
import type { Trade } from '../domain/trade'

let db: KrosmargeDB
let seq = 0

beforeEach(async () => {
  db = new KrosmargeDB(`test-${seq++}`)
  await db.open()
})

describe('PriceRepository', () => {
  it('relit un prix enregistré sous forme de carnet', async () => {
    const repo = makePriceRepository(db)
    await repo.record({ itemId: 5, kamas: 45_000, lotSize: 100, observedAt: 1000 })
    const book = await repo.loadPriceBook()
    expect(book.get(5)).toEqual({ itemId: 5, kamas: 45_000, lotSize: 100, observedAt: 1000 })
  })

  it('écrase le prix courant sans perdre lhistorique', async () => {
    const repo = makePriceRepository(db)
    await repo.record({ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 })
    await repo.record({ itemId: 5, kamas: 200, lotSize: 1, observedAt: 2000 })

    const book = await repo.loadPriceBook()
    expect(book.size).toBe(1)
    expect(book.get(5)?.kamas).toBe(200)
    expect(await repo.historyFor(5)).toHaveLength(2)
  })

  it('renvoie un carnet vide au premier lancement', async () => {
    expect((await makePriceRepository(db).loadPriceBook()).size).toBe(0)
  })
})

describe('TradeRepository', () => {
  const model: Trade = {
    itemId: 1,
    origin: 'purchase',
    quantity: 10,
    unitCost: 1000,
    acquiredAt: 1000,
    listings: [],
    sales: [],
    createdAt: 1000,
  }

  it('enregistre et relit une ligne', async () => {
    const repo = makeTradeRepository(db)
    await repo.add({ ...model })
    const all = await repo.all()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ itemId: 1, quantity: 10, unitCost: 1000 })
  })

  it('persiste les mouvements embarqués', async () => {
    const repo = makeTradeRepository(db)
    const id = await repo.add({ ...model })
    const stored = (await repo.all())[0]
    await repo.save({
      ...stored,
      listings: [{ id: 'a', at: 2000, unitPrice: 2000, quantity: 10 }],
      sales: [{ id: 'b', at: 3000, unitPrice: 2000, quantity: 4 }],
    })

    const reloaded = (await repo.all())[0]
    expect(reloaded.id).toBe(id)
    expect(await repo.all()).toHaveLength(1)
    expect(reloaded.listings).toHaveLength(1)
    expect(reloaded.sales[0]).toMatchObject({ at: 3000, quantity: 4 })
  })

  it('supprime une ligne saisie par erreur', async () => {
    const repo = makeTradeRepository(db)
    const id = await repo.add({ ...model })
    await repo.remove(id)
    expect(await repo.all()).toHaveLength(0)
  })

  it('refuse denregistrer une ligne sans identifiant', async () => {
    // Sans ce garde-fou, `put` creerait une seconde ligne au lieu de mettre a
    // jour la premiere, et le bilan compterait l'operation deux fois.
    await expect(makeTradeRepository(db).save({ ...model })).rejects.toThrow(/identifiant/i)
  })
})

describe('migration depuis lancienne table des ventes', () => {
  it('convertit les ventes v1 en lignes de négoce et supprime lancienne table', async () => {
    /*
     * On ouvre une base au schema v1, on y ecrit une vente, puis on rouvre la
     * MEME base avec le schema courant. C'est le seul moyen d'exercer
     * reellement l'upgrade Dexie plutot que de faire confiance a la lecture du
     * code - et c'est le seul chemin capable de detruire des donnees.
     */
    const name = `migration-${seq++}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      currentPrices: 'itemId',
      priceHistory: '++id, itemId, observedAt',
      sales: '++id, itemId, status, expiresAt',
      settings: 'key',
    })
    await legacy.open()
    await legacy.table('sales').add({
      itemId: 42, quantity: 5, lotSize: 10, unitPrice: 2000,
      listedAt: 1000, expiresAt: 99_000, status: 'sold', closedAt: 50_000,
      frozenCraftCost: 1000,
    })
    legacy.close()

    const upgraded = new KrosmargeDB(name)
    await upgraded.open()
    const trades = await upgraded.trades.toArray()
    expect(trades).toHaveLength(1)
    expect(trades[0]).toMatchObject({ itemId: 42, quantity: 50, unitCost: 1000, origin: 'craft' })
    expect(trades[0].sales[0]).toMatchObject({ at: 50_000, quantity: 50 })
    expect(upgraded.tables.map((t) => t.name)).not.toContain('sales')
    upgraded.close()
  })

  it('ouvre une base neuve directement au schéma courant', async () => {
    const fresh = new KrosmargeDB(`fresh-${seq++}`)
    await fresh.open()
    expect(await fresh.trades.toArray()).toEqual([])
    expect(fresh.tables.map((t) => t.name)).not.toContain('sales')
    fresh.close()
  })
})

describe('SettingsRepository', () => {
  it('renvoie les réglages par défaut quand rien nest enregistré', async () => {
    expect(await makeSettingsRepository(db).load()).toEqual(DEFAULT_SETTINGS)
  })

  it('conserve les réglages enregistrés', async () => {
    const repo = makeSettingsRepository(db)
    await repo.save({ ...DEFAULT_SETTINGS, jobLevels: { tailleur: 120 } })
    expect((await repo.load()).jobLevels).toEqual({ tailleur: 120 })
  })

  it('complète un enregistrement partiel avec les valeurs par défaut', async () => {
    const repo = makeSettingsRepository(db)
    await db.settings.put({ key: 'app', value: { jobLevels: { forgeron: 50 } } })
    const loaded = await repo.load()
    expect(loaded.jobLevels).toEqual({ forgeron: 50 })
    expect(loaded.freshness).toEqual(DEFAULT_SETTINGS.freshness)
  })
})
