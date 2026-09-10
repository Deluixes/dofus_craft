import { listingTax } from './margin'
import { remainingQuantity, type Trade } from './trade'
import { tradeStats, type TradeStats } from './tradeStats'

/**
 * Le module temporel : tout ce qui répond à « comment ça évolue ».
 *
 * Toutes les lignes sont d'abord aplaties en un flux d'événements datés et
 * signés, puis chaque vue se réduit à un regroupement et une somme sur ce flux.
 * Une seule source de vérité, additive par construction.
 *
 * Ce flux est DÉRIVÉ à chaque affichage, jamais persisté. Aucun cumul n'est
 * stocké : une correction rétroactive doit changer les chiffres passés, sans
 * quoi une saisie a posteriori laisserait des totaux périmés.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Jour civil **local** d'un instant, au format `AAAA-MM-JJ`.
 *
 * Le formulaire enregistre minuit local du jour saisi, et cette fonction relit
 * ce même jour local : l'aller-retour est stable par construction. Un stockage
 * en UTC ferait basculer une vente du dimanche soir au lundi selon le fuseau,
 * et un bilan hebdomadaire qui change quand on voyage est un bug qu'on ne
 * comprend jamais.
 */
export function dayKey(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export type Granularity = 'week' | 'month'

/**
 * Semaine ISO (lundi → dimanche) des composantes locales d'un instant.
 *
 * Le calcul est ré-ancré à midi UTC pour être insensible aux journées de 23 ou
 * 25 heures des changements d'heure : à minuit local, un décalage d'une heure
 * suffirait à changer de jour.
 */
function isoWeek(at: number): { year: number; week: number } {
  const local = new Date(at)
  const d = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), 12))

  // On se place sur le jeudi de la semaine : c'est lui qui, par définition ISO,
  // détermine à quelle année la semaine appartient.
  const offset = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - offset + 3)

  const year = d.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(year, 0, 4, 12))
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3)

  return { year, week: 1 + Math.round((d.getTime() - firstThursday.getTime()) / WEEK_MS) }
}

/** Clé de période, construite pour que le tri lexicographique soit chronologique. */
export function periodKey(at: number, granularity: Granularity): string {
  if (granularity === 'month') {
    const d = new Date(at)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  }
  const { year, week } = isoWeek(at)
  return `${year}-W${pad(week)}`
}

export type LedgerEventType = 'acquisition' | 'tax' | 'sale'

export interface LedgerEvent {
  at: number
  type: LedgerEventType
  itemId: number
  tradeId?: number
  /** Effet sur le porte-monnaie : acquisition et taxe négatives, vente positive. */
  cash: number
  /**
   * Effet sur le bénéfice réalisé.
   *   acquisition → 0, acquérir du stock n'est pas une perte
   *   taxe        → négatif, charge de la période où elle a été payée
   *   vente       → recette moins le coût des seules unités écoulées
   */
  profit: number
}

/**
 * Aplatit les lignes en flux d'événements trié par date.
 *
 * Invariants garantis, et testés :
 *   Σ profit ≡ portfolioSummary(...).realizedProfit
 *   Σ cash   ≡ portfolioSummary(...).netCashFlow
 */
export function buildEvents(trades: Trade[]): LedgerEvent[] {
  const events: LedgerEvent[] = []

  for (const trade of trades) {
    events.push({
      at: trade.acquiredAt,
      type: 'acquisition',
      itemId: trade.itemId,
      tradeId: trade.id,
      cash: -trade.unitCost * trade.quantity,
      profit: 0,
    })

    for (const listing of trade.listings) {
      const tax = listingTax(listing.unitPrice, listing.quantity)
      events.push({
        at: listing.at,
        type: 'tax',
        itemId: trade.itemId,
        tradeId: trade.id,
        cash: -tax,
        profit: -tax,
      })
    }

    /*
     * Le coût est imputé vente par vente, mais l'allocation cumulée est plafonnée
     * à la quantité réellement acquise. Sans ce plafond, une sur-vente creuserait
     * le coût au-delà de ce qui a été acheté et romprait l'additivité avec
     * portfolioSummary, qui applique le même plafond.
     */
    let allocated = 0
    const chronological = [...trade.sales].sort((a, b) => a.at - b.at)
    for (const sale of chronological) {
      const billable = Math.max(0, Math.min(sale.quantity, trade.quantity - allocated))
      allocated += billable
      const revenue = sale.unitPrice * sale.quantity
      events.push({
        at: sale.at,
        type: 'sale',
        itemId: trade.itemId,
        tradeId: trade.id,
        cash: revenue,
        profit: revenue - trade.unitCost * billable,
      })
    }
  }

  return events.sort((a, b) => a.at - b.at)
}

export interface CurvePoint {
  day: string
  /** Bénéfice réalisé cumulé depuis le début. */
  profit: number
  /** Trésorerie cumulée : très négative après un réapprovisionnement, c'est normal. */
  cash: number
}

/**
 * Courbe cumulée, un point par jour où il s'est passé quelque chose. Combler
 * les jours vides relève de l'affichage, pas du calcul.
 */
export function cumulativeCurve(events: LedgerEvent[]): CurvePoint[] {
  const points: CurvePoint[] = []
  let profit = 0
  let cash = 0

  for (const event of events) {
    profit += event.profit
    cash += event.cash
    const day = dayKey(event.at)
    const last = points[points.length - 1]
    if (last !== undefined && last.day === day) {
      last.profit = profit
      last.cash = cash
    } else {
      points.push({ day, profit, cash })
    }
  }

  return points
}

export interface PeriodSummary {
  key: string
  invested: number
  recovered: number
  taxes: number
  /** Σ des effets sur le bénéfice. L'investissement n'y entre pas. */
  netProfit: number
  saleCount: number
}

/**
 * Bilan par semaine ou par mois.
 *
 * `Σ netProfit ≡ bénéfice réalisé du portefeuille` sur la même plage : c'est
 * précisément ce que garantit le traitement de la taxe en charge de période.
 * Un prorata la ferait dépendre de ventes futures et changerait rétroactivement
 * les bilans déjà consultés.
 */
export function periodSummaries(events: LedgerEvent[], granularity: Granularity): PeriodSummary[] {
  const byKey = new Map<string, PeriodSummary>()

  for (const event of events) {
    const key = periodKey(event.at, granularity)
    let summary = byKey.get(key)
    if (summary === undefined) {
      summary = { key, invested: 0, recovered: 0, taxes: 0, netProfit: 0, saleCount: 0 }
      byKey.set(key, summary)
    }
    if (event.type === 'acquisition') summary.invested -= event.cash
    if (event.type === 'tax') summary.taxes -= event.cash
    if (event.type === 'sale') {
      summary.recovered += event.cash
      summary.saleCount += 1
    }
    summary.netProfit += event.profit
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export interface DormantTrade {
  trade: Trade
  stats: TradeStats
}

/**
 * Ce qui dort : les lignes portant encore du stock, de la plus ancienne à la
 * plus récente.
 *
 * Les lignes retirées du HDV sont **incluses** : retiré n'est pas vendu, les
 * kamas sont toujours dans l'objet. Les exclure masquerait exactement le stock
 * qui ne part pas, c'est-à-dire ce que cette vue existe pour montrer.
 */
export function dormantTrades(trades: Trade[], now: number): DormantTrade[] {
  return trades
    .filter((trade) => remainingQuantity(trade) > 0)
    .map((trade) => ({ trade, stats: tradeStats(trade, now) }))
    .sort((a, b) => a.trade.acquiredAt - b.trade.acquiredAt)
}

export interface ItemStat {
  itemId: number
  closedCount: number
  soldQuantity: number
  invested: number
  recovered: number
  taxesPaid: number
  realizedProfit: number
  /** `null` si rien n'a été encaissé. */
  marginRate: number | null
}

/**
 * Classement des objets par rentabilité.
 *
 * Regroupé par `itemId` et non par nom, et **les objets sans aucune vente sont
 * écartés** : ils apparaîtraient à hauteur de leurs seules taxes et
 * pollueraient le bas du tableau sans rien dire de leur rentabilité réelle.
 */
export function itemRanking(trades: Trade[]): ItemStat[] {
  const byItem = new Map<number, ItemStat>()

  for (const trade of trades) {
    const s = tradeStats(trade, trade.acquiredAt)
    let stat = byItem.get(trade.itemId)
    if (stat === undefined) {
      stat = {
        itemId: trade.itemId,
        closedCount: 0,
        soldQuantity: 0,
        invested: 0,
        recovered: 0,
        taxesPaid: 0,
        realizedProfit: 0,
        marginRate: null,
      }
      byItem.set(trade.itemId, stat)
    }
    if (s.status === 'sold') stat.closedCount += 1
    stat.soldQuantity += s.soldQuantity
    stat.invested += s.investment
    stat.recovered += s.revenue
    stat.taxesPaid += s.taxesPaid
    stat.realizedProfit += s.realizedProfit
  }

  return [...byItem.values()]
    .filter((stat) => stat.soldQuantity > 0)
    .map((stat) => ({
      ...stat,
      marginRate: stat.recovered === 0 ? null : stat.realizedProfit / stat.recovered,
    }))
    .sort((a, b) => b.realizedProfit - a.realizedProfit)
}
