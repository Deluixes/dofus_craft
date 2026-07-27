import type { PriceEntry } from './types'

/**
 * Prix d'une unité à partir d'un relevé HDV.
 * Le joueur saisit le montant du lot tel qu'affiché en jeu ; la division
 * est faite ici pour lui éviter un calcul mental source d'erreurs.
 */
export function unitPrice(entry: PriceEntry): number {
  return entry.kamas / entry.lotSize
}
