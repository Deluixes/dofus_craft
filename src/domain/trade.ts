/**
 * Le registre de négoce : une ligne = une acquisition, achetée en HDV ou
 * fabriquée, avec l'historique de ses mises en vente et de ses ventes.
 *
 * Principe directeur du modèle : **rien de dérivable n'est stocké**. Ni statut,
 * ni quantité vendue, ni total de taxes. Chacun serait une occasion
 * d'incohérence, pour zéro gain à ce volume de données.
 */

/** Provenance des unités : achetées à l'hôtel des ventes, ou fabriquées. */
export type TradeOrigin = 'purchase' | 'craft'

/**
 * Un événement daté portant un prix unitaire et une quantité.
 *
 * Sert indifféremment à une mise en vente et à une vente : même forme, même
 * sémantique, donc un seul jeu de fonctions et un seul composant de saisie.
 */
export interface Movement {
  id: string
  /** Date de l'événement, epoch ms. Modifiable : la saisie est souvent a posteriori. */
  at: number
  /** Mise en vente : prix DEMANDÉ, base de la taxe. Vente : prix ENCAISSÉ. */
  unitPrice: number
  /** Nombre d'UNITÉS, jamais de lots. Entier strictement positif. */
  quantity: number
}

export interface Trade {
  id?: number
  itemId: number
  origin: TradeOrigin
  /** Quantité acquise, en unités. */
  quantity: number
  /** Prix d'achat HDV unitaire, ou coût de revient unitaire du craft. */
  unitCost: number
  acquiredAt: number

  /**
   * Historique des mises en vente. Chaque entrée est une taxe payée,
   * définitivement perdue, imputée à SA date.
   *
   * Un simple compteur ne suffirait pas : le bilan par période et la courbe
   * cumulée ont besoin de savoir dans quelle semaine chaque taxe a été payée,
   * et une remise en vente se fait en général à un prix différent.
   */
  listings: Movement[]

  /** Ventes, éventuellement partielles : un lot de 100 part rarement d'un coup. */
  sales: Movement[]

  /**
   * Objet retiré du HDV et rapatrié en banque. Seul champ d'état persisté,
   * parce qu'il ne se déduit d'aucun autre.
   *
   * ATTENTION : retiré n'est pas vendu. Le capital reste immobilisé.
   */
  withdrawnAt?: number

  note?: string
  createdAt: number
}

export type TradeStatus = 'inStock' | 'listed' | 'partiallySold' | 'sold' | 'withdrawn'

function totalQuantity(movements: Movement[]): number {
  return movements.reduce((sum, m) => sum + m.quantity, 0)
}

/**
 * Quantité écoulée. Volontairement NON bornée par la quantité acquise : une
 * sur-vente est une erreur de saisie qu'il faut pouvoir détecter, pas masquer.
 */
export function soldQuantity(trade: Trade): number {
  return totalQuantity(trade.sales)
}

/** Quantité encore détenue. Bornée à zéro : un capital immobilisé négatif n'existe pas. */
export function remainingQuantity(trade: Trade): number {
  return Math.max(0, trade.quantity - soldQuantity(trade))
}

/**
 * Prix demandé lors de la mise en vente la plus récente, `null` si l'objet n'a
 * jamais été proposé. Comparé sur les dates et non sur l'ordre du tableau : une
 * saisie a posteriori peut insérer une mise en vente antérieure.
 */
export function lastAskPrice(trade: Trade): number | null {
  let latest: Movement | null = null
  for (const listing of trade.listings) {
    if (latest === null || listing.at >= latest.at) latest = listing
  }
  return latest === null ? null : latest.unitPrice
}

/**
 * Statut dérivé, par ordre de priorité strict. Aucun de ces cinq états n'est
 * stocké : les recalculer interdit qu'ils contredisent les mouvements.
 *
 * L'ordre place `withdrawn` avant `partiallySold` parce qu'un objet retiré du
 * HDV après une vente partielle n'est plus en vente, et une mise en vente
 * postérieure au retrait le périme d'elle-même — il n'y a donc jamais de
 * retrait à annuler explicitement.
 */
export function tradeStatus(trade: Trade): TradeStatus {
  if (soldQuantity(trade) >= trade.quantity) return 'sold'

  if (trade.withdrawnAt !== undefined) {
    const relisted = trade.listings.some((l) => l.at > trade.withdrawnAt!)
    if (!relisted) return 'withdrawn'
  }

  if (soldQuantity(trade) > 0) return 'partiallySold'
  if (trade.listings.length > 0) return 'listed'
  return 'inStock'
}

export interface NewTradeInput {
  itemId: number
  origin: TradeOrigin
  quantity: number
  unitCost: number
  /** Minuit local du jour saisi : c'est ce que le regroupement par période relit. */
  acquiredAt: number
  note?: string
}

/*
 * Les fonctions ci-dessous sont toutes IMMUABLES : elles rendent une nouvelle
 * ligne au lieu de modifier celle qu'on leur passe.
 *
 * Ni l'horloge ni la génération d'identifiants n'apparaissent ici. Comme
 * partout dans `domain/`, l'instant courant et les identifiants de mouvement
 * sont fournis par l'appelant, ce qui laisse chaque règle testable sans avoir
 * à geler le temps ni à simuler `crypto`.
 */

export function createTrade(input: NewTradeInput, createdAt: number): Trade {
  return { ...input, listings: [], sales: [], createdAt }
}

export function withListing(trade: Trade, listing: Movement): Trade {
  return { ...trade, listings: [...trade.listings, listing] }
}

export function withSale(trade: Trade, sale: Movement): Trade {
  return { ...trade, sales: [...trade.sales, sale] }
}

export function withdrawn(trade: Trade, at: number): Trade {
  return { ...trade, withdrawnAt: at }
}

/**
 * Retire un mouvement, quel que soit son bord. Sert à corriger une saisie :
 * sans elle, une remise en vente enregistrée par erreur coûterait une taxe
 * fantôme que rien ne permettrait d'effacer.
 */
export function withoutMovement(trade: Trade, movementId: string): Trade {
  return {
    ...trade,
    listings: trade.listings.filter((m) => m.id !== movementId),
    sales: trade.sales.filter((m) => m.id !== movementId),
  }
}
