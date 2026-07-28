import { describe, it, expect } from 'vitest'
import { surveyPriority, canCraft, MISSING_OBSOLESCENCE } from './surveyPriority'
import { buildCatalogIndex } from '../catalog/loadCatalog'
import { HOUR_MS } from './freshness'
import type { Catalog } from '../catalog/types'
import type { PriceBook } from './types'

const NOW = 1_000_000_000_000

const catalog: Catalog = {
  version: 't',
  items: [
    { id: 1, name: 'Chapeau', type: 'Chapeau', level: 20, imgUrl: '', stats: [] },
    { id: 2, name: 'Cuir', type: 'Peau', level: 1, imgUrl: '', stats: [] },
    { id: 3, name: 'Fil', type: 'Ficelle', level: 1, imgUrl: '', stats: [] },
    { id: 4, name: 'Épée', type: 'Épée', level: 60, imgUrl: '', stats: [] },
    { id: 5, name: 'Fer', type: 'Minerai', level: 1, imgUrl: '', stats: [] },
  ],
  recipes: [
    { resultItemId: 1, job: 'tailleur', ingredients: [{ itemId: 2, quantity: 3 }, { itemId: 3, quantity: 1 }] },
    { resultItemId: 4, job: 'forgeron', ingredients: [{ itemId: 5, quantity: 10 }] },
  ],
}
const index = buildCatalogIndex(catalog)

const book = (entries: Array<[number, number, number]>): PriceBook =>
  new Map(entries.map(([itemId, kamas, ageHours]) => [
    itemId, { itemId, kamas, lotSize: 1 as const, observedAt: NOW - ageHours * HOUR_MS },
  ]))

describe('canCraft', () => {
  it('exige un niveau de métier au moins égal au niveau de lobjet', () => {
    const recipe = index.recipeByResultId.get(1)!
    expect(canCraft(recipe, index, { tailleur: 20 })).toBe(true)
    expect(canCraft(recipe, index, { tailleur: 19 })).toBe(false)
  })

  it('refuse un métier non déclaré', () => {
    expect(canCraft(index.recipeByResultId.get(1)!, index, {})).toBe(false)
  })
})

describe('surveyPriority', () => {
  it('produit une file non vide quand aucun prix nest connu', () => {
    // Régression : fonder l'impact sur la rentabilité viderait la file
    // au premier lancement, exactement quand elle est indispensable.
    const result = surveyPriority(index, new Map(), { tailleur: 200 }, NOW)
    expect(result.length).toBeGreaterThan(0)
  })

  it('inclut lobjet résultat, dont le prix conditionne toute marge', () => {
    const result = surveyPriority(index, new Map(), { tailleur: 200 }, NOW)
    expect(result.map((e) => e.itemId)).toContain(1)
  })

  it('exclut les recettes hors de portée des niveaux de métier', () => {
    const result = surveyPriority(index, new Map(), { tailleur: 200 }, NOW)
    const ids = result.map((e) => e.itemId)
    expect(ids).not.toContain(4)   // Épée, forgeron non déclaré
    expect(ids).not.toContain(5)   // Fer, ingrédient de l'épée seulement
  })

  it('donne une obsolescence forfaitaire élevée aux prix absents', () => {
    const result = surveyPriority(index, new Map(), { tailleur: 200 }, NOW)
    expect(result[0].obsolescence).toBe(MISSING_OBSOLESCENCE)
  })

  it('classe un prix absent avant un prix frais dimpact comparable', () => {
    const prices = book([[2, 100, 0], [3, 100, 0], [1, 5000, 0]])
    prices.delete(3)
    const result = surveyPriority(index, prices, { tailleur: 200 }, NOW)
    expect(result[0].itemId).toBe(3)
  })

  it('trie par priorité décroissante', () => {
    const result = surveyPriority(index, book([[2, 100, 100], [3, 100, 1], [1, 5000, 1]]), { tailleur: 200 }, NOW)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].priority).toBeGreaterThanOrEqual(result[i].priority)
    }
  })

  it('compte les recettes concernées par chaque objet', () => {
    const result = surveyPriority(index, new Map(), { tailleur: 200, forgeron: 200 }, NOW)
    const cuir = result.find((e) => e.itemId === 2)!
    expect(cuir.affectedRecipeCount).toBe(1)
  })

  it('répartit limpact à parts égales tant que les prix manquent', () => {
    const result = surveyPriority(index, new Map(), { tailleur: 200 }, NOW)
    const cuir = result.find((e) => e.itemId === 2)!
    const fil = result.find((e) => e.itemId === 3)!
    expect(cuir.impact).toBeCloseTo(fil.impact, 10)   // 1/2 chacun
  })

  it('pondère limpact par la part réelle du coût une fois les prix connus', () => {
    // Cuir : 3 × 900 = 2700 ; Fil : 1 × 300 = 300 ; total 3000.
    const result = surveyPriority(index, book([[2, 900, 1], [3, 300, 1], [1, 5000, 1]]), { tailleur: 200 }, NOW)
    const cuir = result.find((e) => e.itemId === 2)!
    const fil = result.find((e) => e.itemId === 3)!
    expect(cuir.impact).toBeCloseTo(0.9, 5)
    expect(fil.impact).toBeCloseTo(0.1, 5)
  })

  it('exclut un ingrédient absent du catalogue', () => {
    // Régression : 147 ingrédients du dataset Touch référencent un identifiant
    // sans objet correspondant. Empilés dans la file, ils y arrivaient sans nom
    // ni image — l'écran de relevé n'avait alors plus rien à afficher, ni
    // aucun bouton, et le joueur s'y retrouvait enfermé. Sur le catalogue réel,
    // l'item 3955 occupait la position 10 sur 12 pour un Alchimiste maxé.
    const withOrphan = buildCatalogIndex({
      version: 't',
      items: [
        { id: 1, name: 'Chapeau', type: 'Chapeau', level: 20, imgUrl: '', stats: [] },
        { id: 2, name: 'Cuir', type: 'Peau', level: 1, imgUrl: '', stats: [] },
      ],
      recipes: [
        {
          resultItemId: 1,
          job: 'tailleur',
          ingredients: [{ itemId: 2, quantity: 3 }, { itemId: 3955, quantity: 1 }],
        },
      ],
    })
    const ids = surveyPriority(withOrphan, new Map(), { tailleur: 200 }, NOW).map((e) => e.itemId)
    expect(ids).toContain(2)
    expect(ids).not.toContain(3955)
  })

  it('répartit limpact à parts égales même quand un seul prix manque dans la recette', () => {
    // Cuir a un prix connu, Fil non : la recette reste incomplète, donc TOUS
    // ses ingrédients doivent recevoir 1/n, y compris Cuir. Une variante
    // erronée donnerait à Cuir une part proportionnelle à son propre coût
    // (ici 1, puisqu'il serait alors le seul prix connu de la recette) et
    // réserverait le 1/n forfaitaire au seul ingrédient non tarifé.
    const prices = book([[2, 900, 1], [1, 5000, 1]])
    const result = surveyPriority(index, prices, { tailleur: 200 }, NOW)
    const cuir = result.find((e) => e.itemId === 2)!
    const fil = result.find((e) => e.itemId === 3)!
    expect(cuir.impact).toBeCloseTo(0.5, 10)
    expect(fil.impact).toBeCloseTo(0.5, 10)
  })
})
