import { describe, it, expect } from 'vitest'
import { buildCatalogIndex } from './loadCatalog'
import type { Catalog } from './types'

const catalog: Catalog = {
  version: 'test',
  items: [
    { id: 1, name: 'Chapeau', type: 'Chapeau', level: 10, imgUrl: '', stats: [] },
    { id: 2, name: 'Cuir', type: 'Peau', level: 1, imgUrl: '', stats: [] },
    { id: 3, name: 'Fil', type: 'Ficelle', level: 1, imgUrl: '', stats: [] },
    { id: 4, name: 'Cape', type: 'Cape', level: 12, imgUrl: '', stats: [] },
  ],
  recipes: [
    { resultItemId: 1, job: 'tailleur', ingredients: [{ itemId: 2, quantity: 3 }, { itemId: 3, quantity: 5 }] },
    { resultItemId: 4, job: 'tailleur', ingredients: [{ itemId: 2, quantity: 8 }] },
  ],
}

describe('buildCatalogIndex', () => {
  it('indexe les objets par identifiant', () => {
    const index = buildCatalogIndex(catalog)
    expect(index.itemsById.get(1)?.name).toBe('Chapeau')
    expect(index.itemsById.size).toBe(4)
  })

  it('indexe les recettes par objet résultat', () => {
    const index = buildCatalogIndex(catalog)
    expect(index.recipeByResultId.get(1)?.ingredients).toHaveLength(2)
    expect(index.recipeByResultId.get(2)).toBeUndefined()
  })

  it('indexe les recettes par ingrédient, y compris partagé', () => {
    const index = buildCatalogIndex(catalog)
    // Le Cuir entre dans les deux recettes.
    expect(index.recipesByIngredientId.get(2)).toHaveLength(2)
    expect(index.recipesByIngredientId.get(3)).toHaveLength(1)
    expect(index.recipesByIngredientId.get(1)).toBeUndefined()
  })

  it('conserve la version', () => {
    expect(buildCatalogIndex(catalog).version).toBe('test')
  })
})
