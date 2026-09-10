import { describe, it, expect } from 'vitest'
import { HDV_TAX_PER_MILLE, listingTax, craftMargin } from './margin'

describe('listingTax', () => {
  it('applique un taux de 3 %', () => {
    expect(HDV_TAX_PER_MILLE).toBe(30)
    expect(listingTax(100_000, 1)).toBe(3000)
  })

  it('taxe le lot entier, pas chaque unité séparément', () => {
    /*
     * C'est LE test qui verrouille le choix d'arrondi. 3 % de 33 333 vaut
     * 999,99 : arrondir par unité puis multiplier donnerait 999 × 3 = 2997,
     * alors que le montant réellement engagé, 99 999, est taxé 2999.
     * L'écart paraît dérisoire, mais il est proportionnel à la quantité et se
     * répète à chaque remise en vente.
     */
    expect(listingTax(33_333, 3)).toBe(2999)
    expect(listingTax(33_333, 3)).not.toBe(Math.floor(33_333 * 0.03) * 3)
  })

  it('reste exact là où un taux flottant dériverait', () => {
    // 0.03 * 333_333 vaut 9999.999999999998 : un plancher renverrait 9999.
    expect(listingTax(333_333, 1)).toBe(9999)
    expect(listingTax(333_334, 1)).toBe(10_000)
  })

  it('renvoie un entier quel que soit le prix', () => {
    expect(Number.isInteger(listingTax(12_345, 7))).toBe(true)
    // Un prix unitaire fractionnaire vient d'un lot : 1234 kamas les 100.
    expect(Number.isInteger(listingTax(12.34, 100))).toBe(true)
  })

  it('renvoie zéro pour un prix ou une quantité nulle', () => {
    expect(listingTax(0, 10)).toBe(0)
    expect(listingTax(100_000, 0)).toBe(0)
  })
})

describe('craftMargin', () => {
  it('déduit la taxe et le coût du prix de vente', () => {
    const m = craftMargin(50_000, 100_000)
    expect(m.tax).toBe(3000)
    expect(m.net).toBe(47_000)
    expect(m.pct).toBeCloseTo(0.94, 5)
  })

  it('renvoie une marge négative quand le craft nest pas rentable', () => {
    const m = craftMargin(100_000, 50_000)
    expect(m.net).toBe(-51_500)   // 50000 - 1500 - 100000
    expect(m.pct).toBeCloseTo(-0.515, 5)
  })

  it('rend la taxe visible même quand la marge est négative', () => {
    expect(craftMargin(100_000, 50_000).tax).toBe(1500)
  })

  it('évite une division par zéro quand le coût est nul', () => {
    const m = craftMargin(0, 10_000)
    expect(m.net).toBe(9700)
    expect(m.pct).toBe(0)
  })

  it('reporte le coût et le prix de vente reçus', () => {
    const m = craftMargin(50_000, 100_000)
    expect(m.cost).toBe(50_000)
    expect(m.salePrice).toBe(100_000)
  })
})
