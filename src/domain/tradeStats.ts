import { listingTax } from './margin'
import {
  lastAskPrice,
  remainingQuantity,
  soldQuantity,
  tradeStatus,
  type Trade,
  type TradeStatus,
} from './trade'

const DAY_MS = 24 * 60 * 60 * 1000

export interface TradeStats {
  status: TradeStatus
  soldQuantity: number
  remainingQuantity: number

  /** Coût total d'acquisition de la ligne, vendue ou non. */
  investment: number
  /** Coût des seules unités écoulées. Base du bénéfice réalisé. */
  costOfSold: number
  /** Coût des unités encore détenues, c'est-à-dire le capital immobilisé. */
  committed: number

  /** Somme des taxes de toutes les mises en vente. Perdues définitivement. */
  taxesPaid: number
  /** Kamas réellement encaissés. */
  revenue: number

  /** `revenue - costOfSold - taxesPaid`. Peut être négatif, et c'est normal. */
  realizedProfit: number
  /** Ce que rapporterait le stock restant au dernier prix demandé. */
  unrealizedProfit: number

  lastAskPrice: number | null
  /** Ancienneté du stock dormant, `null` si tout est écoulé. */
  daysHeld: number | null
}

/**
 * Métriques d'une ligne de négoce.
 *
 * Deux pièges sont évités ici, et ce sont les deux seules subtilités du moteur.
 *
 * 1. `costOfSold` porte sur la quantité VENDUE, pas sur la quantité acquise.
 *    Acheter 100 unités et en vendre 10 ne fait pas apparaître 90 unités de
 *    perte : le coût des 90 restantes est du capital immobilisé.
 *
 * 2. Les taxes sont une CHARGE DE PÉRIODE, jamais capitalisées dans le stock.
 *    La taxe est irrécouvrable dès l'instant où elle est payée, sans
 *    contrepartie d'actif. La répartir au prorata des unités vendues ferait
 *    dépendre le bilan d'une semaine passée de ventes futures, et casserait
 *    l'additivité des bilans par période.
 */
export function tradeStats(trade: Trade, now: number): TradeStats {
  const sold = soldQuantity(trade)
  const remaining = remainingQuantity(trade)

  // Plafonné à la quantité acquise : une sur-vente ne doit pas gonfler le coût.
  const billableSold = Math.min(sold, trade.quantity)

  const investment = trade.unitCost * trade.quantity
  const costOfSold = trade.unitCost * billableSold
  const committed = trade.unitCost * remaining

  const taxesPaid = trade.listings.reduce(
    (sum, listing) => sum + listingTax(listing.unitPrice, listing.quantity),
    0,
  )
  const revenue = trade.sales.reduce((sum, sale) => sum + sale.unitPrice * sale.quantity, 0)

  const ask = lastAskPrice(trade)
  const unrealizedProfit = remaining > 0 && ask !== null ? ask * remaining - committed : 0

  return {
    status: tradeStatus(trade),
    soldQuantity: sold,
    remainingQuantity: remaining,
    investment,
    costOfSold,
    committed,
    taxesPaid,
    revenue,
    realizedProfit: revenue - costOfSold - taxesPaid,
    unrealizedProfit,
    lastAskPrice: ask,
    daysHeld: remaining > 0 ? Math.max(0, Math.floor((now - trade.acquiredAt) / DAY_MS)) : null,
  }
}

export interface PortfolioSummary {
  invested: number
  recovered: number
  taxesPaid: number

  /** Le chiffre de tête : est-ce que ce commerce gagne de l'argent ? */
  realizedProfit: number
  unrealizedProfit: number
  committed: number
  /** `recovered - invested - taxesPaid`. Identiquement `realizedProfit - committed`. */
  netCashFlow: number

  tradeCount: number
  closedCount: number

  /** `null`, jamais 0 ni NaN, quand le dénominateur est nul. */
  roi: number | null
  marginRate: number | null
}

/**
 * Agrégat de portefeuille.
 *
 * Doit satisfaire en permanence `realizedProfit - committed === netCashFlow`.
 * C'est le meilleur filet de sécurité du moteur : si l'identité casse sur des
 * données quelconques, c'est qu'un coût est compté deux fois ou oublié.
 *
 * `roi` se rapporte au capital effectivement CONSOMMÉ par les opérations
 * closes — coût des unités vendues plus taxes — et non aux kamas investis :
 * ces derniers incluent le stock encore détenu, donc réapprovisionner ferait
 * chuter le ROI sans qu'aucune opération ait mal tourné.
 */
export function portfolioSummary(trades: Trade[], now: number): PortfolioSummary {
  const summary: PortfolioSummary = {
    invested: 0,
    recovered: 0,
    taxesPaid: 0,
    realizedProfit: 0,
    unrealizedProfit: 0,
    committed: 0,
    netCashFlow: 0,
    tradeCount: trades.length,
    closedCount: 0,
    roi: null,
    marginRate: null,
  }

  for (const trade of trades) {
    const s = tradeStats(trade, now)
    summary.invested += s.investment
    summary.recovered += s.revenue
    summary.taxesPaid += s.taxesPaid
    summary.realizedProfit += s.realizedProfit
    summary.unrealizedProfit += s.unrealizedProfit
    summary.committed += s.committed
    if (s.status === 'sold') summary.closedCount += 1
  }

  summary.netCashFlow = summary.recovered - summary.invested - summary.taxesPaid

  const consumed = summary.recovered - summary.realizedProfit
  if (consumed !== 0) summary.roi = summary.realizedProfit / consumed
  if (summary.recovered !== 0) summary.marginRate = summary.realizedProfit / summary.recovered

  return summary
}
