import type { Ingredient, Item, Recipe, StatRange } from './types'
import { jobForType } from './jobMapping'

export type RawStatEntry = Record<string, { from?: string; to?: string }>
export type RawRecipeEntry = Record<string, { id: string; quantity: string }>

export interface RawItem {
  _id: number
  name: string
  type: string
  lvl: string
  imgUrl: string
  stats?: RawStatEntry[]
  recipe?: RawRecipeEntry[]
}

function toInt(value: string | undefined): number | null {
  if (value === undefined) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

/** Aplatit `[{ "Vitalité": { from, to } }]` en `[{ name, min, max }]`. */
export function normalizeStats(raw: RawStatEntry[] | undefined): StatRange[] {
  const out: StatRange[] = []
  for (const entry of raw ?? []) {
    for (const [name, range] of Object.entries(entry)) {
      const min = toInt(range.from)
      if (min === null) continue
      const max = toInt(range.to)
      out.push({ name, min, max: max ?? min })
    }
  }
  return out
}

/** Aplatit `[{ "Tourmaline": { id, quantity } }]` en `[{ itemId, quantity }]`. */
export function normalizeIngredients(raw: RawRecipeEntry[] | undefined): Ingredient[] {
  const out: Ingredient[] = []
  for (const entry of raw ?? []) {
    for (const ing of Object.values(entry)) {
      const itemId = toInt(ing.id)
      const quantity = toInt(ing.quantity)
      if (itemId === null || quantity === null || quantity <= 0) continue
      out.push({ itemId, quantity })
    }
  }
  return out
}

/** Convertit un objet brut dofapi en objet de catalogue et, le cas échéant, sa recette. */
export function normalizeItem(raw: RawItem): { item: Item; recipe: Recipe | null } {
  const item: Item = {
    id: raw._id,
    name: raw.name,
    type: raw.type,
    level: toInt(raw.lvl) ?? 0,
    imgUrl: raw.imgUrl,
    stats: normalizeStats(raw.stats),
  }
  const ingredients = normalizeIngredients(raw.recipe)
  const recipe: Recipe | null = ingredients.length
    ? { resultItemId: raw._id, job: jobForType(raw.type), ingredients }
    : null
  return { item, recipe }
}
