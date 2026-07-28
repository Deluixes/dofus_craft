import { unitsSold } from '../../domain/sale'
import type { LotSize } from '../../domain/types'

/**
 * Libellé d'une mise en vente : « 5 lots de 100 · 500 unités ».
 *
 * `quantity` est un nombre de lots (voir `unitsSold` dans domain/sale.ts).
 * Écrire « ×5 » à côté d'un sélecteur ×100, comme le faisait l'écran Ventes,
 * laisse le joueur lire 5 unités là où le profit affiché en compte 500 : sur un
 * chiffre d'argent déjà gagné, l'ambiguïté n'est pas acceptable. À `lotSize`
 * de 1, il n'y a pas de lot du tout et le total ne mérite pas d'être répété.
 */
export function describeSaleSize(quantity: number, lotSize: LotSize): string {
  const plural = quantity > 1 ? 's' : ''
  if (lotSize === 1) return `${quantity} unité${plural}`
  const units = unitsSold({ quantity, lotSize })
  return `${quantity} lot${plural} de ${lotSize} · ${units} unités`
}
