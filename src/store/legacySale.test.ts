import { describe, it, expect } from 'vitest'
import { saleToTrade, type LegacySale } from './legacySale'
import { tradeStatus } from '../domain/trade'
import { tradeStats } from '../domain/tradeStats'

const LISTED_AT = new Date(2026, 0, 5).getTime()
const CLOSED_AT = new Date(2026, 0, 9).getTime()
const DAY = 86_400_000

function sale(over: Partial<LegacySale> = {}): LegacySale {
  return {
    id: 7,
    itemId: 42,
    quantity: 5,
    lotSize: 10,
    unitPrice: 2000,
    listedAt: LISTED_AT,
    expiresAt: LISTED_AT + 14 * DAY,
    status: 'listed',
    frozenCraftCost: 1000,
    ...over,
  }
}

describe('saleToTrade', () => {
  it('convertit les lots en unités', () => {
    // `quantity` etait un nombre de LOTS : 5 lots de 10 valent 50 unites.
    expect(saleToTrade(sale()).quantity).toBe(50)
  })

  it('reprend le coût figé comme coût de revient unitaire', () => {
    expect(saleToTrade(sale()).unitCost).toBe(1000)
  })

  it('marque lorigine comme craft', () => {
    // Krosmarge ne suivait que des objets fabriqués : l'achat n'existait pas.
    expect(saleToTrade(sale()).origin).toBe('craft')
  })

  it('reconstitue la mise en vente initiale, donc la taxe déjà payée', () => {
    const trade = saleToTrade(sale())
    expect(trade.listings).toHaveLength(1)
    expect(trade.listings[0]).toMatchObject({ at: LISTED_AT, unitPrice: 2000, quantity: 50 })
    expect(tradeStats(trade, CLOSED_AT).taxesPaid).toBe(3000)
  })

  it('reste en vente pour une vente en cours', () => {
    expect(tradeStatus(saleToTrade(sale()))).toBe('listed')
  })

  it('enregistre la vente pour une vente conclue', () => {
    const trade = saleToTrade(sale({ status: 'sold', closedAt: CLOSED_AT }))
    expect(trade.sales).toHaveLength(1)
    expect(trade.sales[0]).toMatchObject({ at: CLOSED_AT, unitPrice: 2000, quantity: 50 })
    expect(tradeStatus(trade)).toBe('sold')
  })

  it('marque un retour comme retiré, pas comme vendu', () => {
    const trade = saleToTrade(sale({ status: 'returned', closedAt: CLOSED_AT }))
    expect(trade.sales).toHaveLength(0)
    expect(trade.withdrawnAt).toBe(CLOSED_AT)
    expect(tradeStatus(trade)).toBe('withdrawn')
  })

  it('retombe sur léchéance quand la date de clôture manque', () => {
    const trade = saleToTrade(sale({ status: 'returned' }))
    expect(trade.withdrawnAt).toBe(LISTED_AT + 14 * DAY)
  })

  it('conserve le profit réalisé de lancienne vente conclue', () => {
    /*
     * 50 unites vendues 2000, coût figé 1000, taxe 3 % de 100 000 = 3000.
     * C'est exactement ce que calculait realizedProfit apres la correction du
     * taux : la migration ne doit pas reecrire des chiffres deja affiches.
     */
    const trade = saleToTrade(sale({ status: 'sold', closedAt: CLOSED_AT }))
    expect(tradeStats(trade, CLOSED_AT).realizedProfit).toBe(100_000 - 50_000 - 3000)
  })

  it('produit des identifiants de mouvement stables et traçables', () => {
    // Deterministe : rejouer la migration ne doit pas produire d'autres lignes.
    const first = saleToTrade(sale({ status: 'sold', closedAt: CLOSED_AT }))
    const second = saleToTrade(sale({ status: 'sold', closedAt: CLOSED_AT }))
    expect(first.listings[0].id).toBe(second.listings[0].id)
    expect(first.listings[0].id).toContain('7')
    expect(first.listings[0].id).not.toBe(first.sales[0].id)
  })

  it('ne transporte pas lidentifiant de lancienne table', () => {
    // La nouvelle table attribue ses propres cles auto-incrementees.
    expect(saleToTrade(sale()).id).toBeUndefined()
  })
})
