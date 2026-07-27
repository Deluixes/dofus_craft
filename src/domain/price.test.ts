import { describe, it, expect } from 'vitest'
import { unitPrice } from './price'
import type { PriceEntry } from './types'

const entry = (kamas: number, lotSize: 1 | 10 | 100): PriceEntry => ({
  itemId: 1, kamas, lotSize, observedAt: 0,
})

describe('unitPrice', () => {
  it('renvoie le montant tel quel pour un lot de 1', () => {
    expect(unitPrice(entry(4500, 1))).toBe(4500)
  })

  it('divise par 10 pour un lot de 10', () => {
    expect(unitPrice(entry(45000, 10))).toBe(4500)
  })

  it('divise par 100 pour un lot de 100', () => {
    expect(unitPrice(entry(45000, 100))).toBe(450)
  })

  it('gère les prix unitaires non entiers sans arrondir', () => {
    expect(unitPrice(entry(101, 100))).toBeCloseTo(1.01, 5)
  })
})
