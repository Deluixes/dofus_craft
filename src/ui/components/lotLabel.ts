import type { LotSize } from '../../domain/types'

/**
 * Libellé d'une mise en vente : « 5 lots de 100 · 500 unités ».
 *
 * `quantity` est un nombre de LOTS. Écrire « ×5 » à côté d'un sélecteur ×100
 * laisse le joueur lire 5 unités là où le profit en compte 500 : sur un chiffre
 * d'argent, l'ambiguïté n'est pas acceptable. À `lotSize` de 1, il n'y a pas de
 * lot du tout et le total ne mérite pas d'être répété.
 *
 * Le registre de négoce, lui, ne raisonne qu'en unités : cette conversion ne
 * subsiste que pour la saisie depuis le détail d'un craft, où le joueur pense
 * naturellement en lots comme le jeu les lui présente.
 */
export function describeSaleSize(quantity: number, lotSize: LotSize): string {
  const plural = quantity > 1 ? 's' : ''
  if (lotSize === 1) return `${quantity} unité${plural}`
  return `${quantity} lot${plural} de ${lotSize} · ${quantity * lotSize} unités`
}
