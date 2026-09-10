import type { Movement, Trade } from '../domain/trade'

/**
 * L'ancienne table `sales`, telle qu'elle existait avant le registre de négoce.
 *
 * Le type est redéclaré ici plutôt qu'importé de `domain/sale` : ce module doit
 * survivre à la suppression de l'ancien domaine, et une sauvegarde v1 exportée
 * aujourd'hui devra pouvoir être relue dans un an.
 */
export interface LegacySale {
  id?: number
  itemId: number
  /** Nombre de LOTS, pas d'unités. Le total d'unités vaut quantity × lotSize. */
  quantity: number
  lotSize: number
  unitPrice: number
  listedAt: number
  expiresAt: number
  status: 'listed' | 'sold' | 'returned'
  closedAt?: number
  /** Coût unitaire de production, figé à la mise en vente. */
  frozenCraftCost: number
}

/**
 * Convertit une vente de l'ancien modèle en ligne de négoce.
 *
 * Règle de conversion unique, partagée par la migration Dexie et par l'import
 * d'une sauvegarde v1 : deux implémentations divergeraient tôt ou tard, et
 * l'écart ne se verrait que sur des chiffres d'argent déjà affichés.
 *
 * Trois correspondances méritent d'être explicites :
 *   - `quantity` était un nombre de lots ; le registre compte des unités ;
 *   - une vente `returned` devient un RETRAIT, jamais une vente : le capital
 *     reste immobilisé, et la taxe de la mise en vente reste perdue ;
 *   - `origin` vaut toujours `craft`, parce que Krosmarge ne suivait que des
 *     objets fabriqués — l'achat n'existait pas.
 */
export function saleToTrade(sale: LegacySale): Trade {
  const units = sale.quantity * sale.lotSize
  const reference = sale.id ?? sale.listedAt

  const listing: Movement = {
    id: `legacy-${reference}-listing`,
    at: sale.listedAt,
    unitPrice: sale.unitPrice,
    quantity: units,
  }

  const sales: Movement[] =
    sale.status === 'sold'
      ? [
          {
            id: `legacy-${reference}-sale`,
            at: sale.closedAt ?? sale.listedAt,
            unitPrice: sale.unitPrice,
            quantity: units,
          },
        ]
      : []

  const trade: Trade = {
    itemId: sale.itemId,
    origin: 'craft',
    quantity: units,
    unitCost: sale.frozenCraftCost,
    acquiredAt: sale.listedAt,
    listings: [listing],
    sales,
    createdAt: sale.listedAt,
  }

  if (sale.status === 'returned') {
    trade.withdrawnAt = sale.closedAt ?? sale.expiresAt
  }

  return trade
}
