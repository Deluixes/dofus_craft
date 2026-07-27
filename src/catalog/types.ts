export type Job =
  | 'tailleur' | 'bijoutier' | 'cordonnier' | 'forgeron' | 'sculpteur'
  | 'faconneur' | 'bricoleur' | 'alchimiste' | 'paysan' | 'mineur'
  | 'bucheron' | 'pecheur' | 'chasseur' | 'inconnu'

export const JOB_LABELS: Record<Job, string> = {
  tailleur: 'Tailleur', bijoutier: 'Bijoutier', cordonnier: 'Cordonnier',
  forgeron: 'Forgeron', sculpteur: 'Sculpteur', faconneur: 'Façonneur',
  bricoleur: 'Bricoleur', alchimiste: 'Alchimiste', paysan: 'Paysan',
  mineur: 'Mineur', bucheron: 'Bûcheron', pecheur: 'Pêcheur',
  chasseur: 'Chasseur', inconnu: 'Métier inconnu',
}

export interface StatRange { name: string; min: number; max: number }

export interface Ingredient { itemId: number; quantity: number }

export interface Item {
  id: number
  name: string
  type: string
  level: number
  imgUrl: string
  stats: StatRange[]
}

export interface Recipe {
  resultItemId: number
  job: Job
  ingredients: Ingredient[]
}

export interface Catalog {
  version: string
  items: Item[]
  recipes: Recipe[]
}

export interface CatalogIndex {
  version: string
  itemsById: Map<number, Item>
  recipeByResultId: Map<number, Recipe>
  recipesByIngredientId: Map<number, Recipe[]>
}
