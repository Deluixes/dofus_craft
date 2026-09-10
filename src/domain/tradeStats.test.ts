import { describe, it, expect } from 'vitest'
import { tradeStats, portfolioSummary } from './tradeStats'
import type { Movement, Trade } from './trade'

const day = (n: number) => Date.UTC(2026, 0, 1 + n)
const NOW = day(30)

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
    acquiredAt: day(0),
    listings: [],
    sales: [],
    createdAt: day(0),
    ...over,
  }
}

function soldLike(): Trade {
  return trade({
    quantity: 10,
    unitCost: 1000,
    listings: [movement(day(1), 2000, 10), movement(day(4), 1900, 10)],
    sales: [movement(day(2), 2000, 4), movement(day(6), 1900, 6)],
  })
}

function stuckLike(): Trade {
  return trade({ itemId: 2, quantity: 100, unitCost: 500, listings: [movement(day(3), 700, 100)] })
}

describe('tradeStats — opération simple', () => {
  it('calcule le bénéfice dune revente gagnante', () => {
    const t = trade({
      quantity: 10,
      unitCost: 1000,
      listings: [movement(day(1), 2000, 10)],
      sales: [movement(day(2), 2000, 10)],
    })
    const s = tradeStats(t, NOW)
    expect(s.investment).toBe(10_000)
    expect(s.revenue).toBe(20_000)
    expect(s.taxesPaid).toBe(600) // 3 % de 20 000
    expect(s.costOfSold).toBe(10_000)
    expect(s.committed).toBe(0)
    expect(s.realizedProfit).toBe(9400)
  })

  it('rend une perte négative sans la ramener à zéro', () => {
    const t = trade({
      quantity: 10,
      unitCost: 1000,
      listings: [movement(day(1), 500, 10)],
      sales: [movement(day(2), 500, 10)],
    })
    const s = tradeStats(t, NOW)
    expect(s.taxesPaid).toBe(150)
    expect(s.realizedProfit).toBe(5000 - 10_000 - 150)
  })
})

describe('tradeStats — le piège du stock invendu', () => {
  it('ne compte pas les unités invendues en perte', () => {
    /*
     * 100 achetées, 60 vendues. Le coût des 40 restantes est du CAPITAL
     * IMMOBILISÉ, pas une perte : les compter dans le bénéfice afficherait un
     * chiffre faux et déprimant à chaque réapprovisionnement.
     */
    const t = trade({
      quantity: 100,
      unitCost: 1000,
      listings: [movement(day(1), 2000, 100)],
      sales: [movement(day(2), 2000, 60)],
    })
    const s = tradeStats(t, NOW)
    expect(s.investment).toBe(100_000)
    expect(s.costOfSold).toBe(60_000) // et non 100 000
    expect(s.committed).toBe(40_000)
    expect(s.revenue).toBe(120_000)
    expect(s.taxesPaid).toBe(6000)
    expect(s.realizedProfit).toBe(120_000 - 60_000 - 6000)
  })

  it('valorise le stock restant au coût, jamais au prix espéré', () => {
    const t = trade({ quantity: 100, unitCost: 1000, listings: [movement(day(1), 5000, 100)] })
    expect(tradeStats(t, NOW).committed).toBe(100_000)
  })
})

describe('tradeStats — taxes des remises en vente', () => {
  it('cumule la taxe de chaque mise en vente, aux prix effectivement demandés', () => {
    /*
     * On baisse le prix à chaque relance. Un compteur multiplié par le prix
     * courant donnerait 3 x 6000 = 18 000, soit 4500 kamas de taxe inventés.
     */
    const t = trade({
      quantity: 10,
      unitCost: 1000,
      listings: [
        movement(day(1), 30_000, 10),
        movement(day(5), 25_000, 10),
        movement(day(9), 20_000, 10),
      ],
    })
    const s = tradeStats(t, NOW)
    expect(s.taxesPaid).toBe(9000 + 7500 + 6000)
    expect(s.taxesPaid).not.toBe(3 * 6000)
  })

  it('affiche un bénéfice négatif pour un objet jamais vendu', () => {
    // Les taxes sont une charge de période, jamais capitalisées dans le stock.
    const t = trade({
      quantity: 10,
      unitCost: 1000,
      listings: [movement(day(1), 2000, 10), movement(day(5), 1800, 10)],
    })
    const s = tradeStats(t, NOW)
    expect(s.revenue).toBe(0)
    expect(s.costOfSold).toBe(0)
    expect(s.realizedProfit).toBe(-(600 + 540))
    expect(s.committed).toBe(10_000)
  })
})

describe('tradeStats — bénéfice latent', () => {
  it('projette le stock restant au dernier prix demandé', () => {
    const t = trade({
      quantity: 100,
      unitCost: 1000,
      listings: [movement(day(1), 2000, 100)],
      sales: [movement(day(2), 2000, 60)],
    })
    expect(tradeStats(t, NOW).unrealizedProfit).toBe(40 * 2000 - 40 * 1000)
  })

  it('vaut zéro tant quaucun prix na été demandé', () => {
    // Un objet en stock jamais proposé n'a pas de valeur de marché connue.
    expect(tradeStats(trade(), NOW).unrealizedProfit).toBe(0)
  })
})

describe('tradeStats — ancienneté du stock', () => {
  it('compte les jours depuis lacquisition tant quil reste des unités', () => {
    expect(tradeStats(trade({ acquiredAt: day(10) }), day(30)).daysHeld).toBe(20)
  })

  it('ne compte plus rien une fois tout vendu', () => {
    const t = trade({ quantity: 10, sales: [movement(day(2), 2000, 10)] })
    expect(tradeStats(t, NOW).daysHeld).toBeNull()
  })
})

describe('tradeStats — saisie erronée', () => {
  it('borne le capital immobilisé à zéro en cas de sur-vente', () => {
    const t = trade({ quantity: 10, unitCost: 1000, sales: [movement(day(2), 2000, 15)] })
    const s = tradeStats(t, NOW)
    expect(s.committed).toBe(0)
    expect(s.costOfSold).toBe(10_000) // plafonné à la quantité réellement acquise
  })
})

describe('portfolioSummary', () => {
  it('agrège les lignes', () => {
    const p = portfolioSummary([soldLike(), stuckLike()], NOW)
    expect(p.invested).toBe(10_000 + 50_000)
    expect(p.recovered).toBe(2000 * 4 + 1900 * 6)
    expect(p.committed).toBe(50_000)
    expect(p.tradeCount).toBe(2)
    expect(p.closedCount).toBe(1)
  })

  it('respecte lidentité comptable', () => {
    /*
     * beneficeRealise - capitalImmobilise = recupere - investi - taxes.
     * Si elle casse, un coût est compté deux fois ou oublié quelque part.
     */
    const p = portfolioSummary([soldLike(), stuckLike()], NOW)
    expect(p.realizedProfit - p.committed).toBe(p.netCashFlow)
    expect(p.netCashFlow).toBe(p.recovered - p.invested - p.taxesPaid)
  })

  it('renvoie null plutôt que zéro ou NaN sur un portefeuille vide', () => {
    const p = portfolioSummary([], NOW)
    expect(p.realizedProfit).toBe(0)
    expect(p.roi).toBeNull()
    expect(p.marginRate).toBeNull()
  })

  it('rapporte le ROI au capital réellement consommé, pas au stock détenu', () => {
    /*
     * Diviser par les kamas investis inclurait le stock encore en rayon :
     * racheter du stock ferait chuter le ROI sans qu'aucune opération ait mal
     * tourné. Le dénominateur est donc le coût des unités vendues, taxes
     * comprises puisque ce sont des kamas réellement engagés.
     */
    const p = portfolioSummary([soldLike(), stuckLike()], NOW)
    const consumed = p.recovered - p.realizedProfit
    expect(p.roi).toBeCloseTo(p.realizedProfit / consumed, 10)
  })
})

describe('portfolioSummary — invariants sur données générées', () => {
  /** Générateur déterministe : un test qui échoue doit pouvoir être rejoué. */
  function makeRng(seed: number) {
    let s = seed
    return () => {
      s = (s * 1103515245 + 12345) % 2147483648
      return s / 2147483648
    }
  }

  it('conserve lidentité comptable sur 200 portefeuilles aléatoires', () => {
    const rng = makeRng(42)
    const pick = (max: number) => 1 + Math.floor(rng() * max)

    for (let run = 0; run < 200; run++) {
      const trades: Trade[] = []
      for (let i = 0; i < pick(6); i++) {
        const quantity = pick(100)
        const listings: Movement[] = []
        const sales: Movement[] = []
        for (let l = 0; l < pick(4); l++) {
          listings.push(movement(day(pick(20)), pick(50_000), quantity))
        }
        let left = quantity
        for (let v = 0; v < pick(3) && left > 0; v++) {
          const q = Math.min(left, pick(quantity))
          sales.push(movement(day(pick(25)), pick(50_000), q))
          left -= q
        }
        trades.push(trade({ itemId: i, quantity, unitCost: pick(5000), listings, sales }))
      }

      const p = portfolioSummary(trades, NOW)
      expect(p.realizedProfit - p.committed).toBe(p.netCashFlow)
      expect(Number.isSafeInteger(p.realizedProfit)).toBe(true)
      expect(Number.isSafeInteger(p.taxesPaid)).toBe(true)
    }
  })

  it('ne dépend pas de lordre des mouvements ni des lignes', () => {
    const reference = portfolioSummary([soldLike(), stuckLike()], NOW)
    const shuffled = [stuckLike(), soldLike()].map((t) => ({
      ...t,
      listings: [...t.listings].reverse(),
      sales: [...t.sales].reverse(),
    }))
    expect(portfolioSummary(shuffled, NOW)).toEqual(reference)
  })
})
