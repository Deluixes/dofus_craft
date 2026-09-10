/**
 * Taxe de l'hôtel des ventes Dofus Touch, exprimée en POUR MILLE ENTIERS.
 * 30 pour mille = 3 %. Le jeu est passé de 2 % à 3 %.
 *
 * Entier plutôt que `0.03` : 0.03 n'est pas représentable exactement en binaire.
 * `0.03 * 333_333` vaut 9999.999999999998, et un plancher renverrait donc 9999
 * au lieu de 10000. En pour mille entiers, `prix * 30 / 1000` est exact tant que
 * le produit reste sous 2^53 — dix ordres de grandeur de marge sur des montants
 * en kamas.
 */
export const HDV_TAX_PER_MILLE = 30

/**
 * Taxe d'UNE mise en vente. Elle est prélevée au moment de la mise en vente et
 * n'est jamais remboursée : retirer un objet invendu pour le reproposer moins
 * cher coûte une seconde fois la taxe.
 *
 * Seul arrondi de tout le moteur, et il est appliqué **une fois, sur le montant
 * total du lot**. Arrondir par unité puis multiplier amplifierait l'erreur par
 * la quantité — jusqu'à un kama par unité, à chaque remise en vente.
 *
 * Plancher plutôt qu'arrondi au plus proche : un plancher ne peut jamais
 * inventer une charge qui n'a pas été payée. L'écart est d'au plus 1 kama, et le
 * choix est centralisé ici : s'il s'avère que le jeu arrondit autrement, une
 * seule ligne change.
 */
export function listingTax(unitPrice: number, quantity: number): number {
  return Math.floor((unitPrice * quantity * HDV_TAX_PER_MILLE) / 1000)
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
  const tax = listingTax(salePrice, 1)
  const net = salePrice - tax - cost
  return { cost, salePrice, tax, net, pct: cost === 0 ? 0 : net / cost }
}
