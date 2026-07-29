/** Taxe HDV Dofus Touch, prélevée à la mise en vente et non à la vente. */
export const HDV_TAX_RATE = 0.02

export function saleTax(salePrice: number): number {
  return salePrice * HDV_TAX_RATE
}

export interface CraftMargin {
  cost: number
  salePrice: number
  tax: number
  net: number
  /** Marge nette rapportée au coût. `0` si le coût est nul. */
  pct: number
}

export function craftMargin(cost: number, salePrice: number): CraftMargin {
  const tax = saleTax(salePrice)
  const net = salePrice - tax - cost
  return { cost, salePrice, tax, net, pct: cost === 0 ? 0 : net / cost }
}
