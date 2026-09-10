import { describe, it, expect } from 'vitest'
import {
  dayKey,
  periodKey,
  buildEvents,
  cumulativeCurve,
  periodSummaries,
  dormantTrades,
  itemRanking,
} from './ledger'
import { portfolioSummary } from './tradeStats'
import type { Movement, Trade } from './trade'

/** Minuit local du jour choisi — exactement ce qu'enregistre le formulaire. */
const day = (m: number, d: number) => new Date(2026, m - 1, d).getTime()

let seq = 0
function movement(at: number, unitPrice: number, quantity: number): Movement {
  seq += 1
  return { id: 'm' + seq, at, unitPrice, quantity }
}

function trade(over: Partial<Trade> = {}): Trade {
  return {
    itemId: 1,
    origin: 'purchase',
    quantity: 10,
    unitCost: 1000,
    acquiredAt: day(1, 1),
    listings: [],
    sales: [],
    createdAt: day(1, 1),
    ...over,
  }
}

describe('dayKey', () => {
  it('rend le jour civil local', () => {
    expect(dayKey(day(9, 7))).toBe('2026-09-07')
  })

  it('reste sur le jour choisi quelle que soit la zone horaire du poste', () => {
    /*
     * Le formulaire enregistre minuit LOCAL du jour saisi. Le regroupement
     * relit ce même jour local : l'aller-retour est stable par construction,
     * là où un stockage en UTC ferait basculer une vente du dimanche soir au
     * lundi selon l'endroit où l'on se trouve.
     */
    for (const [m, d] of [[1, 1], [6, 15], [12, 31]] as const) {
      expect(dayKey(new Date(2026, m - 1, d).getTime())).toBe(
        `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      )
    }
  })

  it('ne bascule pas de jour au passage à lheure dété', () => {
    // Dernier dimanche de mars : la journée ne dure que 23 heures.
    expect(dayKey(day(3, 29))).toBe('2026-03-29')
    expect(dayKey(day(3, 30))).toBe('2026-03-30')
  })
})

describe('periodKey', () => {
  it('numérote les mois', () => {
    expect(periodKey(day(9, 7), 'month')).toBe('2026-09')
  })

  it('numérote les semaines ISO, du lundi au dimanche', () => {
    // 2026-09-07 est un lundi, 2026-09-13 le dimanche suivant.
    expect(periodKey(day(9, 7), 'week')).toBe('2026-W37')
    expect(periodKey(day(9, 13), 'week')).toBe('2026-W37')
    expect(periodKey(day(9, 14), 'week')).toBe('2026-W38')
  })

  it('rattache une semaine à cheval sur deux mois à une seule clé', () => {
    // 2026-08-31 est un lundi : la semaine 36 déborde sur septembre.
    expect(periodKey(day(8, 31), 'week')).toBe('2026-W36')
    expect(periodKey(day(9, 1), 'week')).toBe('2026-W36')
  })

  it('rattache les tout derniers jours de décembre à la semaine 1 suivante', () => {
    // 2026-12-31 est un jeudi : semaine ISO 53 de 2026.
    expect(periodKey(day(12, 31), 'week')).toBe('2026-W53')
    // 2027-01-01 est un vendredi, même semaine ISO.
    expect(periodKey(new Date(2027, 0, 1).getTime(), 'week')).toBe('2026-W53')
  })

  it('se trie chronologiquement dans lordre lexicographique', () => {
    const keys = [day(9, 14), day(1, 5), day(9, 7)].map((t) => periodKey(t, 'week'))
    expect([...keys].sort()).toEqual(['2026-W02', '2026-W37', '2026-W38'])
  })
})

describe('buildEvents', () => {
  const t = trade({
    quantity: 10,
    unitCost: 1000,
    acquiredAt: day(1, 5),
    listings: [movement(day(1, 6), 2000, 10)],
    sales: [movement(day(1, 8), 2000, 10)],
  })

  it('aplatit une ligne en acquisition, taxes et ventes', () => {
    expect(buildEvents([t]).map((e) => e.type)).toEqual(['acquisition', 'tax', 'sale'])
  })

  it('trie par date, quel que soit lordre de saisie', () => {
    const messy = trade({
      listings: [movement(day(2, 1), 2000, 10), movement(day(1, 6), 2500, 10)],
      sales: [movement(day(1, 20), 2000, 5)],
    })
    const dates = buildEvents([messy]).map((e) => e.at)
    expect(dates).toEqual([...dates].sort((a, b) => a - b))
  })

  it('signe les effets de trésorerie', () => {
    const [acquisition, tax, sale] = buildEvents([t])
    expect(acquisition.cash).toBe(-10_000)
    expect(tax.cash).toBe(-600)
    expect(sale.cash).toBe(20_000)
  })

  it('nimpute aucune perte à lacquisition', () => {
    // Acheter du stock n'est pas une perte, c'est un déplacement de valeur.
    expect(buildEvents([t])[0].profit).toBe(0)
  })

  it('somme exactement le bénéfice réalisé du portefeuille', () => {
    const trades = [t, trade({ itemId: 2, listings: [movement(day(2, 2), 900, 10)] })]
    const total = buildEvents(trades).reduce((s, e) => s + e.profit, 0)
    expect(total).toBe(portfolioSummary(trades, day(3, 1)).realizedProfit)
  })

  it('somme exactement le flux de trésorerie net', () => {
    const trades = [t, trade({ itemId: 2, listings: [movement(day(2, 2), 900, 10)] })]
    const total = buildEvents(trades).reduce((s, e) => s + e.cash, 0)
    expect(total).toBe(portfolioSummary(trades, day(3, 1)).netCashFlow)
  })

  it('plafonne le coût imputé aux ventes à la quantité réellement acquise', () => {
    // Une sur-vente ne doit pas creuser le coût au-delà de ce qui a été acheté,
    // sous peine de casser l'additivité avec portfolioSummary.
    const over = trade({
      quantity: 10,
      unitCost: 1000,
      sales: [movement(day(1, 8), 2000, 8), movement(day(1, 9), 2000, 7)],
    })
    const total = buildEvents([over]).reduce((s, e) => s + e.profit, 0)
    expect(total).toBe(portfolioSummary([over], day(3, 1)).realizedProfit)
  })
})

describe('cumulativeCurve', () => {
  const trades = [
    trade({
      quantity: 10,
      unitCost: 1000,
      acquiredAt: day(1, 5),
      listings: [movement(day(1, 6), 2000, 10)],
      sales: [movement(day(1, 8), 2000, 10)],
    }),
  ]

  it('produit un point par jour où il se passe quelque chose', () => {
    expect(cumulativeCurve(buildEvents(trades)).map((p) => p.day)).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-08',
    ])
  })

  it('cumule bénéfice et trésorerie', () => {
    const points = cumulativeCurve(buildEvents(trades))
    expect(points.map((p) => p.profit)).toEqual([0, -600, 9400])
    expect(points.map((p) => p.cash)).toEqual([-10_000, -10_600, 9400])
  })

  it('regroupe les événements du même jour en un seul point', () => {
    const sameDay = [
      trade({ acquiredAt: day(1, 5), listings: [movement(day(1, 5), 2000, 10)] }),
    ]
    expect(cumulativeCurve(buildEvents(sameDay))).toHaveLength(1)
  })

  it('renvoie une courbe vide sans opération', () => {
    expect(cumulativeCurve([])).toEqual([])
  })
})

describe('periodSummaries', () => {
  const trades = [
    trade({
      quantity: 10,
      unitCost: 1000,
      acquiredAt: day(1, 5),
      listings: [movement(day(1, 6), 2000, 10)],
      sales: [movement(day(2, 10), 2000, 10)],
    }),
  ]

  it('ventile investissement, recettes et taxes dans leurs mois respectifs', () => {
    const months = periodSummaries(buildEvents(trades), 'month')
    expect(months.map((p) => p.key)).toEqual(['2026-01', '2026-02'])
    expect(months[0]).toMatchObject({ invested: 10_000, taxes: 600, recovered: 0, netProfit: -600 })
    expect(months[1]).toMatchObject({ invested: 0, taxes: 0, recovered: 20_000, netProfit: 10_000 })
  })

  it('compte les ventes de chaque période', () => {
    const months = periodSummaries(buildEvents(trades), 'month')
    expect(months.map((p) => p.saleCount)).toEqual([0, 1])
  })

  it('somme exactement le bénéfice réalisé, en mensuel comme en hebdomadaire', () => {
    /*
     * L'additivité est la raison pour laquelle la taxe est traitée en charge de
     * période plutôt qu'au prorata des unités vendues.
     */
    const target = portfolioSummary(trades, day(3, 1)).realizedProfit
    const events = buildEvents(trades)
    for (const granularity of ['month', 'week'] as const) {
      const total = periodSummaries(events, granularity).reduce((s, p) => s + p.netProfit, 0)
      expect(total).toBe(target)
    }
  })

  it('rend les périodes triées et sans trou de tri', () => {
    const spread = [
      trade({ acquiredAt: day(12, 1) }),
      trade({ itemId: 2, acquiredAt: day(1, 15) }),
      trade({ itemId: 3, acquiredAt: day(6, 3) }),
    ]
    const keys = periodSummaries(buildEvents(spread), 'month').map((p) => p.key)
    expect(keys).toEqual([...keys].sort())
  })
})

describe('dormantTrades', () => {
  it('ne retient que les lignes portant encore du stock', () => {
    const sold = trade({ quantity: 10, sales: [movement(day(1, 8), 2000, 10)] })
    const stuck = trade({ itemId: 2, quantity: 10, acquiredAt: day(1, 1) })
    expect(dormantTrades([sold, stuck], day(2, 1)).map((d) => d.trade.itemId)).toEqual([2])
  })

  it('inclut les lignes retirées du HDV', () => {
    /*
     * Retiré n'est pas vendu : l'objet est en banque, les kamas sont toujours
     * dedans. L'exclure masquerait précisément le stock qui ne part pas.
     */
    const withdrawn = trade({ itemId: 3, listings: [movement(day(1, 2), 2000, 10)], withdrawnAt: day(1, 20) })
    expect(dormantTrades([withdrawn], day(2, 1))).toHaveLength(1)
  })

  it('trie du plus ancien au plus récent', () => {
    const trades = [
      trade({ itemId: 1, acquiredAt: day(2, 1) }),
      trade({ itemId: 2, acquiredAt: day(1, 1) }),
      trade({ itemId: 3, acquiredAt: day(1, 20) }),
    ]
    expect(dormantTrades(trades, day(3, 1)).map((d) => d.trade.itemId)).toEqual([2, 3, 1])
  })

  it('totalise un capital immobilisé égal à celui du portefeuille', () => {
    const trades = [
      trade({ quantity: 100, unitCost: 500 }),
      trade({ itemId: 2, quantity: 10, sales: [movement(day(1, 8), 2000, 10)] }),
    ]
    const total = dormantTrades(trades, day(2, 1)).reduce((s, d) => s + d.stats.committed, 0)
    expect(total).toBe(portfolioSummary(trades, day(2, 1)).committed)
  })
})

describe('itemRanking', () => {
  const trades = [
    trade({
      itemId: 1, quantity: 10, unitCost: 1000,
      listings: [movement(day(1, 6), 2000, 10)],
      sales: [movement(day(1, 8), 2000, 10)],
    }),
    trade({
      itemId: 1, quantity: 5, unitCost: 1000,
      listings: [movement(day(2, 6), 1500, 5)],
      sales: [movement(day(2, 8), 1500, 5)],
    }),
    trade({
      itemId: 2, quantity: 10, unitCost: 3000,
      listings: [movement(day(1, 6), 2000, 10)],
      sales: [movement(day(1, 8), 2000, 10)],
    }),
  ]

  it('regroupe les lignes par objet', () => {
    const ranked = itemRanking(trades)
    expect(ranked.find((r) => r.itemId === 1)?.soldQuantity).toBe(15)
  })

  it('classe du plus rentable au moins rentable', () => {
    expect(itemRanking(trades).map((r) => r.itemId)).toEqual([1, 2])
  })

  it('rend les pertes visibles', () => {
    expect(itemRanking(trades).find((r) => r.itemId === 2)?.realizedProfit).toBeLessThan(0)
  })

  it('écarte les objets sans aucune vente', () => {
    /*
     * Un objet jamais vendu apparaîtrait a -taxes et polluerait le bas du
     * classement sans rien dire de sa rentabilite reelle.
     */
    const withStock = [...trades, trade({ itemId: 9, listings: [movement(day(1, 2), 500, 10)] })]
    expect(itemRanking(withStock).map((r) => r.itemId)).not.toContain(9)
  })

  it('renvoie un classement vide sans opération close', () => {
    expect(itemRanking([trade({ itemId: 9 })])).toEqual([])
  })
})
