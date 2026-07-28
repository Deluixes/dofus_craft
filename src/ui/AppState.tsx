import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadCatalog } from '../catalog/loadCatalog'
import type { CatalogIndex } from '../catalog/types'
import { db } from '../store/db'
import {
  makePriceRepository,
  makeSaleRepository,
  makeSettingsRepository,
  DEFAULT_SETTINGS,
  type AppSettings,
} from '../store/repositories'
import type { PriceBook, LotSize } from '../domain/types'
import type { Sale } from '../domain/sale'

const prices = makePriceRepository(db)
const sales = makeSaleRepository(db)
const settingsRepo = makeSettingsRepository(db)

interface AppStateValue {
  catalog: CatalogIndex | null
  priceBook: PriceBook
  settings: AppSettings
  saleList: Sale[]
  error: string | null
  recordPrice(itemId: number, kamas: number, lotSize: LotSize): Promise<void>
  saveSettings(next: AppSettings): Promise<void>
  addSale(sale: Sale): Promise<void>
  refreshSales(): Promise<void>
  closeSale(id: number, status: 'sold' | 'returned'): Promise<void>
}

const Ctx = createContext<AppStateValue | null>(null)

/**
 * État partagé de l'application : catalogue, prix relevés, réglages et ventes.
 *
 * C'est ici — et nulle part dans `domain/` — que l'horloge est lue. Le domaine
 * reçoit toujours un instant en paramètre, ce qui le laisse testable sans
 * geler le temps.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null)
  const [priceBook, setPriceBook] = useState<PriceBook>(new Map())
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saleList, setSaleList] = useState<Sale[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setCatalog(await loadCatalog())
        setPriceBook(await prices.loadPriceBook())
        setSettings(await settingsRepo.load())
        setSaleList(await sales.all())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chargement impossible')
      }
    })()
  }, [])

  const value: AppStateValue = {
    catalog,
    priceBook,
    settings,
    saleList,
    error,
    async recordPrice(itemId, kamas, lotSize) {
      await prices.record({ itemId, kamas, lotSize, observedAt: Date.now() })
      setPriceBook(await prices.loadPriceBook())
    },
    async saveSettings(next) {
      await settingsRepo.save(next)
      setSettings(next)
    },
    async addSale(sale) {
      await sales.add(sale)
      setSaleList(await sales.all())
    },
    async refreshSales() {
      setSaleList(await sales.all())
    },
    async closeSale(id, status) {
      await sales.close(id, status, Date.now())
      setSaleList(await sales.all())
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState(): AppStateValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppState doit être utilisé dans AppStateProvider')
  return ctx
}
