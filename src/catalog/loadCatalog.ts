import type { Catalog, CatalogIndex } from './types'

export const CATALOG_URL = '/catalog.v1.json'

/**
 * Construit les index runtime. `recipesByIngredientId` est indispensable au
 * calcul de priorité du relevé : sans lui, chaque évaluation impliquerait un
 * parcours complet des 2200 recettes.
 */
export function buildCatalogIndex(catalog: Catalog): CatalogIndex {
  const itemsById = new Map(catalog.items.map((item) => [item.id, item]))
  const recipeByResultId = new Map(catalog.recipes.map((r) => [r.resultItemId, r]))
  const recipesByIngredientId = new Map<number, typeof catalog.recipes>()

  for (const recipe of catalog.recipes) {
    for (const ing of recipe.ingredients) {
      const list = recipesByIngredientId.get(ing.itemId)
      if (list) list.push(recipe)
      else recipesByIngredientId.set(ing.itemId, [recipe])
    }
  }

  return { version: catalog.version, itemsById, recipeByResultId, recipesByIngredientId }
}

export async function loadCatalog(url: string = CATALOG_URL): Promise<CatalogIndex> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Catalogue introuvable (${response.status})`)
  return buildCatalogIndex((await response.json()) as Catalog)
}
