import { describe, it, expect } from 'vitest'
import {
  createTrade,
  withListing,
  withSale,
  withdrawn,
  tradeStatus,
  type Movement,
  type Trade,
} from './trade'
import { tradeStats, portfolioSummary } from './tradeStats'
import { buildEvents, cumulativeCurve, periodSummaries, dormantTrades, itemRanking } from './ledger'

/**
 * Scénario de bout en bout, sur une opération réaliste et complète.
 *
 * Tous les montants ci-dessous ont été calculés À LA MAIN avant d'être écrits,
 * puis confrontés au moteur. C'est le seul test du dépôt dont l'intérêt n'est
 * pas de couvrir une règle isolée mais de vérifier que les huit modules
 * s'accordent sur le même argent.
 *
 * L'histoire :
 *   5 janv.  — achat de 100 ressources à 500 l'unité
 *   6 janv.  — les 100 mises en vente à 800
 *   8 janv.  — 60 partent à 800
 *  10 janv.  — les 40 restantes remises en vente, moins cher : 700
 *  12 janv.  — 20 partent à 700
 *  20 janv.  — les 20 dernières retirées du HDV
 */

const day = (d: number) => new Date(2026, 0, d).getTime()
const NOW = day(25)

let seq = 0
function movement(at: number, unitPrice: number, quantity: number): Movement {
  seq += 1
  return { id: 'm' + seq, at, unitPrice, quantity }
}

function buildScenario(): Trade {
  let trade = createTrade(
    { itemId: 42, origin: 'purchase', quantity: 100, unitCost: 500, acquiredAt: day(5) },
    day(5),
  )
  trade = withListing(trade, movement(day(6), 800, 100))
  trade = withSale(trade, movement(day(8), 800, 60))
  trade = withListing(trade, movement(day(10), 700, 40))
  trade = withSale(trade, movement(day(12), 700, 20))
  trade = withdrawn(trade, day(20))
  return { ...trade, id: 1 }
}

const TRADE = buildScenario()

/*
 * Les taxes, calculées à la main :
 *   6 janv. : 3 % de 800 × 100 = 3 % de 80 000 = 2 400
 *  10 janv. : 3 % de 700 ×  40 = 3 % de 28 000 =   840
 *                                       total  = 3 240
 */
const TAX_FIRST = 2400
const TAX_SECOND = 840
const TAXES = TAX_FIRST + TAX_SECOND

const INVESTED = 500 * 100 // 50 000
const REVENUE = 800 * 60 + 700 * 20 // 48 000 + 14 000 = 62 000
const COST_OF_SOLD = 500 * 80 // 40 000
const COMMITTED = 500 * 20 // 10 000
const REALIZED = REVENUE - COST_OF_SOLD - TAXES // 18 760
const NET_CASH = REVENUE - INVESTED - TAXES // 8 760

describe('scénario complet — une opération de la première à la dernière unité', () => {
  it('finit retiré du HDV, et non vendu', () => {
    // 20 unités dorment encore en banque : le capital n'est pas libéré.
    expect(tradeStatus(TRADE)).toBe('withdrawn')
  })

  it('rend les montants calculés à la main', () => {
    const s = tradeStats(TRADE, NOW)
    expect(s.investment).toBe(INVESTED)
    expect(s.revenue).toBe(REVENUE)
    expect(s.taxesPaid).toBe(TAXES)
    expect(s.costOfSold).toBe(COST_OF_SOLD)
    expect(s.committed).toBe(COMMITTED)
    expect(s.realizedProfit).toBe(REALIZED)
    expect(s.soldQuantity).toBe(80)
    expect(s.remainingQuantity).toBe(20)
  })

  it('taxe chaque mise en vente à son propre prix', () => {
    // Un compteur multiplié par le prix courant donnerait 2 × 840 = 1 680.
    expect(tradeStats(TRADE, NOW).taxesPaid).toBe(TAXES)
    expect(tradeStats(TRADE, NOW).taxesPaid).not.toBe(2 * TAX_SECOND)
  })

  it('projette les 20 unités restantes au dernier prix demandé', () => {
    expect(tradeStats(TRADE, NOW).unrealizedProfit).toBe(700 * 20 - COMMITTED)
  })

  it('compte lancienneté depuis lachat, pas depuis le retrait', () => {
    expect(tradeStats(TRADE, NOW).daysHeld).toBe(20)
  })

  it('respecte lidentité comptable', () => {
    const p = portfolioSummary([TRADE], NOW)
    expect(p.realizedProfit).toBe(REALIZED)
    expect(p.netCashFlow).toBe(NET_CASH)
    expect(p.realizedProfit - p.committed).toBe(p.netCashFlow)
  })

  it('trace la courbe cumulée jour par jour', () => {
    /*
     * Verifie a la main :
     *   05 : achat            benefice      0   tresorerie -50 000
     *   06 : taxe 2 400                -2 400              -52 400
     *   08 : 60 x 800 - 60 x 500      +15 600               -4 400
     *   10 : taxe 840                 +14 760               -5 240
     *   12 : 20 x 700 - 20 x 500      +18 760               +8 760
     */
    expect(cumulativeCurve(buildEvents([TRADE]))).toEqual([
      { day: '2026-01-05', profit: 0, cash: -50_000 },
      { day: '2026-01-06', profit: -2400, cash: -52_400 },
      { day: '2026-01-08', profit: 15_600, cash: -4400 },
      { day: '2026-01-10', profit: 14_760, cash: -5240 },
      { day: '2026-01-12', profit: 18_760, cash: 8760 },
    ])
  })

  it('ventile le tout dans le mois de janvier', () => {
    expect(periodSummaries(buildEvents([TRADE]), 'month')).toEqual([
      {
        key: '2026-01',
        invested: INVESTED,
        recovered: REVENUE,
        taxes: TAXES,
        netProfit: REALIZED,
        saleCount: 2,
      },
    ])
  })

  it('signale les 20 unités qui dorment', () => {
    const dormant = dormantTrades([TRADE], NOW)
    expect(dormant).toHaveLength(1)
    expect(dormant[0].stats.committed).toBe(COMMITTED)
    expect(dormant[0].stats.remainingQuantity).toBe(20)
  })

  it('classe lobjet avec sa marge', () => {
    const [stat] = itemRanking([TRADE])
    expect(stat).toMatchObject({ itemId: 42, soldQuantity: 80, realizedProfit: REALIZED })
    expect(stat.marginRate).toBeCloseTo(REALIZED / REVENUE, 10)
  })

  it('cesse dêtre retiré si les 20 dernières repartent en HDV', () => {
    /*
     * Le retrait n'a pas besoin d'etre annule : une mise en vente posterieure
     * suffit a le perimer. Le statut redevient alors « partiellement vendu »
     * plutot que « en vente », et c'est plus juste - 80 unites sur 100 sont
     * bien parties. L'ecran Negoce regroupe de toute facon les deux etats sous
     * « En vente ».
     */
    const relisted = withListing(TRADE, movement(day(22), 600, 20))
    expect(tradeStatus(relisted)).toBe('partiallySold')
    expect(tradeStatus(relisted)).not.toBe('withdrawn')
    expect(tradeStats(relisted, NOW).taxesPaid).toBe(TAXES + 360) // 3 % de 12 000
  })

  it('reste cohérent si la ligne est supprimée', () => {
    expect(portfolioSummary([], NOW)).toEqual(portfolioSummary([], NOW))
    expect(portfolioSummary([], NOW).realizedProfit).toBe(0)
  })
})
