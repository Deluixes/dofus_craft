import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadCatalog } from '../catalog/loadCatalog'
import type { CatalogIndex } from '../catalog/types'
import { db } from '../store/db'
import {
  makePriceRepository,
  makeTradeRepository,
  makeSettingsRepository,
  DEFAULT_SETTINGS,
  type AppSettings,
} from '../store/repositories'
import type { PriceBook, LotSize } from '../domain/types'
import type { Movement, NewTradeInput, Trade } from '../domain/trade'
import { createTrade, withListing, withSale, withdrawn, withoutMovement } from '../domain/trade'

const prices = makePriceRepository(db)
const trades = makeTradeRepository(db)
const settingsRepo = makeSettingsRepository(db)

interface AppStateValue {
  catalog: CatalogIndex | null
  priceBook: PriceBook
  settings: AppSettings
  tradeList: Trade[]
  error: string | null
  recordPrice(itemId: number, kamas: number, lotSize: LotSize): Promise<void>
  saveSettings(next: AppSettings): Promise<void>
  /** `listing` non nul met la ligne en vente dans la foulée, taxe comprise. */
  addTrade(input: NewTradeInput, listing?: { unitPrice: number; quantity: number } | null): Promise<void>
  removeTrade(id: number): Promise<void>
  listTrade(id: number, unitPrice: number, quantity: number, at: number): Promise<void>
  sellTrade(id: number, unitPrice: number, quantity: number, at: number): Promise<void>
  withdrawTrade(id: number, at: number): Promise<void>
  dropMovement(id: number, movementId: string): Promise<void>
  refreshTrades(): Promise<void>
}

const Ctx = createContext<AppStateValue | null>(null)

/**
 * État partagé de l'application : catalogue, prix relevés, réglages et registre
 * de négoce.
 *
 * C'est ici — et nulle part dans `domain/` — que l'horloge est lue et que les
 * identifiants de mouvement sont engendrés. Le domaine reçoit toujours un
 * instant et un identifiant en paramètre, ce qui le laisse testable sans geler
 * le temps ni simuler `crypto`.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null)
  const [priceBook, setPriceBook] = useState<PriceBook>(new Map())
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [tradeList, setTradeList] = useState<Trade[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setCatalog(await loadCatalog())
        setPriceBook(await prices.loadPriceBook())
        setSettings(await settingsRepo.load())
        setTradeList(await trades.all())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chargement impossible')
      }
    })()
  }, [])

  /** Applique une transformation pure à une ligne, puis la persiste. */
  async function mutate(id: number, change: (trade: Trade) => Trade): Promise<void> {
    const current = (await trades.all()).find((t) => t.id === id)
    if (current === undefined) return
    await trades.save(change(current))
    setTradeList(await trades.all())
  }

  function movement(unitPrice: number, quantity: number, at: number): Movement {
    return { id: crypto.randomUUID(), at, unitPrice, quantity }
  }

  const value: AppStateValue = {
    catalog,
    priceBook,
    settings,
    tradeList,
    error,
    async recordPrice(itemId, kamas, lotSize) {
      await prices.record({ itemId, kamas, lotSize, observedAt: Date.now() })
      setPriceBook(await prices.loadPriceBook())
    },
    async saveSettings(next) {
      await settingsRepo.save(next)
      setSettings(next)
    },
    async addTrade(input, listing = null) {
      const now = Date.now()
      let trade = createTrade(input, now)
      if (listing !== null) {
        trade = withListing(trade, movement(listing.unitPrice, listing.quantity, input.acquiredAt))
      }
      await trades.add(trade)
      setTradeList(await trades.all())
    },
    async removeTrade(id) {
      await trades.remove(id)
      setTradeList(await trades.all())
    },
    async listTrade(id, unitPrice, quantity, at) {
      await mutate(id, (t) => withListing(t, movement(unitPrice, quantity, at)))
    },
    async sellTrade(id, unitPrice, quantity, at) {
      await mutate(id, (t) => withSale(t, movement(unitPrice, quantity, at)))
    },
    async withdrawTrade(id, at) {
      await mutate(id, (t) => withdrawn(t, at))
    },
    async dropMovement(id, movementId) {
      await mutate(id, (t) => withoutMovement(t, movementId))
    },
    async refreshTrades() {
      setTradeList(await trades.all())
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState(): AppStateValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppState doit être utilisé dans AppStateProvider')
  return ctx
}
