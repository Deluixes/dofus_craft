import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { KrosmargeDB } from './db'
import { makePriceRepository, makeSaleRepository, makeSettingsRepository, DEFAULT_SETTINGS } from './repositories'
import { createSale } from '../domain/sale'

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

describe('SaleRepository', () => {
  it('enregistre et relit les ventes en cours', async () => {
    const repo = makeSaleRepository(db)
    await repo.add(createSale({ itemId: 1, quantity: 2, lotSize: 1, unitPrice: 100, frozenCraftCost: 60 }, 1000))
    expect(await repo.listed()).toHaveLength(1)
  })

  it('sépare les ventes closes des ventes en cours', async () => {
    const repo = makeSaleRepository(db)
    const id = await repo.add(createSale({ itemId: 1, quantity: 2, lotSize: 1, unitPrice: 100, frozenCraftCost: 60 }, 1000))
    await repo.close(id, 'sold', 5000)

    expect(await repo.listed()).toHaveLength(0)
    const all = await repo.all()
    expect(all[0].status).toBe('sold')
    expect(all[0].closedAt).toBe(5000)
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
