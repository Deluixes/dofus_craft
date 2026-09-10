import { describe, it, expect } from 'vitest'
import {
  soldQuantity,
  remainingQuantity,
  lastAskPrice,
  tradeStatus,
  createTrade,
  withListing,
  withSale,
  withdrawn,
  withoutMovement,
  type Movement,
  type Trade,
} from './trade'

/** 1er janvier 2026 + n jours, en millisecondes. */
const day = (n: number) => Date.UTC(2026, 0, 1 + n)

let seq = 0
function movement(at: number, unitPrice: number, quantity: number): Movement {
  return { id: `m${++seq}`, at, unitPrice, quantity }
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

describe('soldQuantity', () => {
  it('additionne les quantités de toutes les ventes', () => {
    const t = trade({ sales: [movement(day(1), 2000, 6), movement(day(3), 1800, 3)] })
    expect(soldQuantity(t)).toBe(9)
  })

  it('vaut zéro quand rien nest vendu', () => {
    expect(soldQuantity(trade())).toBe(0)
  })
})

describe('remainingQuantity', () => {
  it('retranche ce qui est vendu', () => {
    const t = trade({ quantity: 100, sales: [movement(day(1), 2000, 60)] })
    expect(remainingQuantity(t)).toBe(40)
  })

  it('ne descend jamais sous zéro, même en cas de sur-vente', () => {
    /*
     * Une saisie erronée ne doit pas produire un capital immobilisé négatif,
     * qui gonflerait artificiellement le bénéfice affiché.
     */
    const t = trade({ quantity: 10, sales: [movement(day(1), 2000, 15)] })
    expect(remainingQuantity(t)).toBe(0)
  })
})

describe('lastAskPrice', () => {
  it('renvoie le prix de la mise en vente la plus récente', () => {
    const t = trade({ listings: [movement(day(1), 3000, 10), movement(day(5), 2500, 10)] })
    expect(lastAskPrice(t)).toBe(2500)
  })

  it('se fie aux dates, pas à lordre du tableau', () => {
    // La saisie a posteriori peut insérer une mise en vente antérieure.
    const t = trade({ listings: [movement(day(5), 2500, 10), movement(day(1), 3000, 10)] })
    expect(lastAskPrice(t)).toBe(2500)
  })

  it('renvoie null quand lobjet na jamais été mis en vente', () => {
    expect(lastAskPrice(trade())).toBeNull()
  })
})

describe('tradeStatus', () => {
  it('en stock tant que rien nest mis en vente', () => {
    expect(tradeStatus(trade())).toBe('inStock')
  })

  it('en vente dès la première mise en vente', () => {
    expect(tradeStatus(trade({ listings: [movement(day(1), 2000, 10)] }))).toBe('listed')
  })

  it('partiellement vendu quand une partie seulement est écoulée', () => {
    const t = trade({
      quantity: 100,
      listings: [movement(day(1), 2000, 100)],
      sales: [movement(day(2), 2000, 60)],
    })
    expect(tradeStatus(t)).toBe('partiallySold')
  })

  it('vendu quand tout est écoulé', () => {
    const t = trade({
      quantity: 10,
      listings: [movement(day(1), 2000, 10)],
      sales: [movement(day(2), 2000, 10)],
    })
    expect(tradeStatus(t)).toBe('sold')
  })

  it('retiré quand lobjet est rapatrié en banque', () => {
    const t = trade({ listings: [movement(day(1), 2000, 10)], withdrawnAt: day(15) })
    expect(tradeStatus(t)).toBe('withdrawn')
  })

  it('repasse en vente si une mise en vente suit le retrait', () => {
    /*
     * Le retrait est le seul état persisté ; il n'a pas besoin d'être annulé
     * explicitement, une mise en vente postérieure suffit à le périmer.
     */
    const t = trade({
      listings: [movement(day(1), 2000, 10), movement(day(20), 1800, 10)],
      withdrawnAt: day(15),
    })
    expect(tradeStatus(t)).toBe('listed')
  })

  it('reste vendu même si un retrait est enregistré', () => {
    const t = trade({
      quantity: 10,
      listings: [movement(day(1), 2000, 10)],
      sales: [movement(day(2), 2000, 10)],
      withdrawnAt: day(15),
    })
    expect(tradeStatus(t)).toBe('sold')
  })

  it('reste retiré si une partie a été vendue avant le retrait', () => {
    // Le capital des unités restantes est toujours immobilisé : retiré, pas vendu.
    const t = trade({
      quantity: 100,
      listings: [movement(day(1), 2000, 100)],
      sales: [movement(day(2), 2000, 60)],
      withdrawnAt: day(15),
    })
    expect(tradeStatus(t)).toBe('withdrawn')
  })
})

describe('mutations immuables', () => {
  const listing: Movement = { id: 'L1', at: day(1), unitPrice: 2000, quantity: 10 }
  const sale: Movement = { id: 'S1', at: day(2), unitPrice: 2000, quantity: 4 }

  it('cree une ligne sans aucun mouvement', () => {
    const t = createTrade(
      { itemId: 7, origin: 'purchase', quantity: 10, unitCost: 1000, acquiredAt: day(0) },
      day(0),
    )
    expect(t.listings).toEqual([])
    expect(t.sales).toEqual([])
    expect(tradeStatus(t)).toBe('inStock')
  })

  it('ajoute une mise en vente sans toucher a la ligne dorigine', () => {
    const before = trade()
    const after = withListing(before, listing)
    expect(before.listings).toHaveLength(0)
    expect(after.listings).toEqual([listing])
  })

  it('ajoute une vente sans toucher a la ligne dorigine', () => {
    const before = trade()
    const after = withSale(before, sale)
    expect(before.sales).toHaveLength(0)
    expect(after.sales).toEqual([sale])
  })

  it('enregistre un retrait', () => {
    expect(withdrawn(withListing(trade(), listing), day(15)).withdrawnAt).toBe(day(15))
  })

  it('retire un mouvement quel que soit son bord', () => {
    const t = withSale(withListing(trade(), listing), sale)
    expect(withoutMovement(t, 'L1').listings).toHaveLength(0)
    expect(withoutMovement(t, 'L1').sales).toHaveLength(1)
    expect(withoutMovement(t, 'S1').sales).toHaveLength(0)
  })

  it('efface la taxe fantome dune remise en vente saisie par erreur', () => {
    // Sans cette correction, une relance enregistree par megarde couterait une
    // taxe que rien ne permettrait d'effacer.
    const t = withListing(withListing(trade(), listing), { ...listing, id: 'L2', at: day(5) })
    expect(withoutMovement(t, 'L2').listings.map((m) => m.id)).toEqual(['L1'])
  })

  it('ignore un identifiant inconnu', () => {
    const t = withListing(trade(), listing)
    expect(withoutMovement(t, 'inexistant')).toEqual(t)
  })
})
