import { describe, it, expect } from 'vitest'
import { HDV_TAX_RATE, saleTax, craftMargin } from './margin'

describe('saleTax', () => {
  it('applique un taux de 2 %', () => {
    expect(HDV_TAX_RATE).toBe(0.02)
    expect(saleTax(100_000)).toBe(2000)
  })

  it('renvoie zéro pour un prix nul', () => {
    expect(saleTax(0)).toBe(0)
  })
})

describe('craftMargin', () => {
  it('déduit la taxe et le coût du prix de vente', () => {
    const m = craftMargin(50_000, 100_000)
    expect(m.tax).toBe(2000)
    expect(m.net).toBe(48_000)
    expect(m.pct).toBeCloseTo(0.96, 5)
  })

  it('renvoie une marge négative quand le craft nest pas rentable', () => {
    const m = craftMargin(100_000, 50_000)
    expect(m.net).toBe(-51_000)   // 50000 - 1000 - 100000
    expect(m.pct).toBeCloseTo(-0.51, 5)
  })

  it('rend la taxe visible même quand la marge est négative', () => {
    expect(craftMargin(100_000, 50_000).tax).toBe(1000)
  })

  it('évite une division par zéro quand le coût est nul', () => {
    const m = craftMargin(0, 10_000)
    expect(m.net).toBe(9800)
    expect(m.pct).toBe(0)
  })

  it('reporte le coût et le prix de vente reçus', () => {
    const m = craftMargin(50_000, 100_000)
    expect(m.cost).toBe(50_000)
    expect(m.salePrice).toBe(100_000)
  })
})
