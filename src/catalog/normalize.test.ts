import { describe, it, expect } from 'vitest'
import { normalizeStats, normalizeIngredients, normalizeItem } from './normalize'
import type { RawItem } from './normalize'

describe('normalizeStats', () => {
  it('aplatit les objets à clé unique en tableau typé', () => {
    expect(normalizeStats([{ 'Vitalité': { from: '351', to: '400' } }]))
      .toEqual([{ name: 'Vitalité', min: 351, max: 400 }])
  })

  it('traite une borne haute absente comme égale à la borne basse', () => {
    // Cas réel : "PO": { "from": "1" }
    expect(normalizeStats([{ 'PO': { from: '1' } }]))
      .toEqual([{ name: 'PO', min: 1, max: 1 }])
  })

  it('conserve les bornes négatives', () => {
    // Cas réel : "Retrait PA": { "from": "-7", "to": "10" }
    expect(normalizeStats([{ 'Retrait PA': { from: '-7', to: '10' } }]))
      .toEqual([{ name: 'Retrait PA', min: -7, max: 10 }])
  })

  it('renvoie un tableau vide pour undefined ou pour une liste vide', () => {
    expect(normalizeStats(undefined)).toEqual([])
    expect(normalizeStats([])).toEqual([])
  })

  it('ignore une entrée dont la borne basse nest pas numérique', () => {
    expect(normalizeStats([{ 'Cassé': { from: 'abc' } }])).toEqual([])
  })
})

describe('normalizeIngredients', () => {
  it('convertit les identifiants et quantités en nombres', () => {
    expect(normalizeIngredients([
      { 'Tourmaline': { id: '15259', quantity: '12' } },
      { 'Andésite': { id: '15750', quantity: '25' } },
    ])).toEqual([
      { itemId: 15259, quantity: 12 },
      { itemId: 15750, quantity: 25 },
    ])
  })

  it('renvoie un tableau vide pour undefined ou pour une recette vide', () => {
    expect(normalizeIngredients(undefined)).toEqual([])
    expect(normalizeIngredients([])).toEqual([])
  })

  it('ignore les ingrédients de quantité nulle ou négative', () => {
    expect(normalizeIngredients([{ 'X': { id: '1', quantity: '0' } }])).toEqual([])
    expect(normalizeIngredients([{ 'X': { id: '1', quantity: '-3' } }])).toEqual([])
  })
})

describe('normalizeItem', () => {
  const raw: RawItem = {
    _id: 15757,
    name: 'Le Dorado',
    type: 'Chapeau',
    lvl: '200',
    imgUrl: 'https://s.ankama.com/x.png',
    stats: [{ 'Vitalité': { from: '351', to: '400' } }],
    recipe: [{ 'Tourmaline': { id: '15259', quantity: '12' } }],
  }

  it('produit un objet et sa recette avec le métier résolu', () => {
    const { item, recipe } = normalizeItem(raw)
    expect(item).toEqual({
      id: 15757, name: 'Le Dorado', type: 'Chapeau', level: 200,
      imgUrl: 'https://s.ankama.com/x.png',
      stats: [{ name: 'Vitalité', min: 351, max: 400 }],
    })
    expect(recipe).toEqual({
      resultItemId: 15757, job: 'tailleur',
      ingredients: [{ itemId: 15259, quantity: 12 }],
    })
  })

  it('ne produit pas de recette pour un objet sans recette', () => {
    const { item, recipe } = normalizeItem({ ...raw, recipe: [] })
    expect(item.id).toBe(15757)
    expect(recipe).toBeNull()
  })

  it('produit une recette de métier inconnu pour un type non mappé', () => {
    const { recipe } = normalizeItem({ ...raw, type: 'Sac à dos' })
    expect(recipe?.job).toBe('inconnu')
  })

  it('traite un niveau non numérique comme 0', () => {
    expect(normalizeItem({ ...raw, lvl: '' }).item.level).toBe(0)
  })
})
