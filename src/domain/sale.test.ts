import { describe, it, expect } from 'vitest'
import {
  createSale, isExpired, hoursUntilExpiry, realizedProfit, committedKamas, unitsSold,
  SALE_DURATION_MS,
} from './sale'

const NOW = 1_000_000_000_000
const DAY = 86_400_000

const input = { itemId: 1, quantity: 5, lotSize: 1 as const, unitPrice: 10_000, frozenCraftCost: 6000 }

describe('createSale', () => {
  it('fixe lexpiration à 14 jours', () => {
    expect(SALE_DURATION_MS).toBe(14 * DAY)
    const sale = createSale(input, NOW)
    expect(sale.expiresAt).toBe(NOW + 14 * DAY)
  })

  it('démarre au statut en vente', () => {
    expect(createSale(input, NOW).status).toBe('listed')
  })

  it('fige le coût de craft transmis', () => {
    expect(createSale(input, NOW).frozenCraftCost).toBe(6000)
  })
})

describe('isExpired', () => {
  it('est faux avant léchéance', () => {
    expect(isExpired(createSale(input, NOW), NOW + 13 * DAY)).toBe(false)
  })

  it('est vrai à léchéance et après', () => {
    expect(isExpired(createSale(input, NOW), NOW + 14 * DAY)).toBe(true)
    expect(isExpired(createSale(input, NOW), NOW + 20 * DAY)).toBe(true)
  })
})

describe('hoursUntilExpiry', () => {
  it('renvoie les heures restantes', () => {
    expect(hoursUntilExpiry(createSale(input, NOW), NOW + 13 * DAY)).toBe(24)
  })

  it('renvoie zéro plutôt quune valeur négative après expiration', () => {
    expect(hoursUntilExpiry(createSale(input, NOW), NOW + 20 * DAY)).toBe(0)
  })
})

describe('realizedProfit', () => {
  it('déduit la taxe et le coût figé, multipliés par la quantité', () => {
    // (10000 - 200 - 6000) × 5 = 19000
    expect(realizedProfit(createSale(input, NOW))).toBe(19_000)
  })

  it('peut être négatif si le coût dépasse le prix net', () => {
    const bad = createSale({ ...input, unitPrice: 5000 }, NOW)
    expect(realizedProfit(bad)).toBe((5000 - 100 - 6000) * 5)
  })

  // `quantity` est un nombre de LOTS : 5 lots de 10 valent 50 unités. Avant
  // correction, `lotSize` était écrit dans la vente puis lu par personne, et
  // un joueur qui mettait 5 lots de 100 en vente voyait le profit de 5 unités
  // — faux d'un facteur 100 sur de l'argent déjà gagné.
  it('multiplie par le nombre dunités, lots compris', () => {
    const parDix = createSale({ ...input, lotSize: 10 }, NOW)
    expect(realizedProfit(parDix)).toBe((10_000 - 200 - 6000) * 50)   // 190 000
  })

  it('rapporte cent fois plus en lots de cent quà lunité', () => {
    const parCent = createSale({ ...input, lotSize: 100 }, NOW)
    expect(realizedProfit(parCent)).toBe(1_900_000)
    expect(realizedProfit(parCent)).toBe(realizedProfit(createSale(input, NOW)) * 100)
  })
})

describe('unitsSold', () => {
  it('multiplie le nombre de lots par leur taille', () => {
    expect(unitsSold({ quantity: 5, lotSize: 100 })).toBe(500)
    expect(unitsSold({ quantity: 5, lotSize: 1 })).toBe(5)
  })
})

describe('committedKamas', () => {
  it('somme les coûts figés des seules ventes en cours', () => {
    const listed = createSale(input, NOW)
    const sold = { ...createSale(input, NOW), status: 'sold' as const }
    expect(committedKamas([listed, sold])).toBe(6000 * 5)
  })

  it('renvoie zéro sans vente en cours', () => {
    expect(committedKamas([])).toBe(0)
  })

  it('immobilise le coût de toutes les unités des lots en vente', () => {
    // 5 lots de 10 = 50 unités à 6000 k de coût figé.
    expect(committedKamas([createSale({ ...input, lotSize: 10 }, NOW)])).toBe(6000 * 50)
  })
})
