import { describe, it, expect } from 'vitest'
import { normalize, indexItems, searchItems, MIN_QUERY_LENGTH } from './itemSearch'
import type { Item } from '../catalog/types'

function item(id: number, name: string, type = 'Ressource', level = 1): Item {
  return { id, name, type, level, imgUrl: '', stats: [] }
}

const CATALOG = [
  item(1, 'Bouftou Royal', 'Familier', 60),
  item(2, 'Peau de Bouftou'),
  item(3, 'Épée du Bouftou', 'Épée', 20),
  item(4, 'Gelée Bleue'),
  item(5, 'Bouclier Céleste', 'Bouclier', 100),
  item(6, "Coiffe de l'Aventurier", 'Chapeau', 1),
]
const INDEX = indexItems(CATALOG)

describe('normalize', () => {
  it('supprime les accents et passe en minuscules', () => {
    expect(normalize('Épée du Bouftou')).toBe('epee du bouftou')
    expect(normalize('Gelée Bleue')).toBe('gelee bleue')
  })

  it('traite les caractères accentués les plus fréquents du catalogue', () => {
    expect(normalize('Bouclier Céleste')).toBe('bouclier celeste')
    expect(normalize('Âme de Tofu')).toBe('ame de tofu')
    expect(normalize('Écorce')).toBe('ecorce')
  })

  it('laisse lapostrophe, qui fait partie du nom', () => {
    expect(normalize("Coiffe de l'Aventurier")).toBe("coiffe de l'aventurier")
  })
})

describe('searchItems', () => {
  it('trouve un objet sans avoir à taper les accents', () => {
    expect(searchItems(INDEX, 'epee').map((i) => i.id)).toEqual([3])
  })

  it('place les correspondances de début de nom en premier', () => {
    /*
     * En tapant « bouf », on cherche Bouftou Royal avant les objets qui ne font
     * que le mentionner. Ces derniers restent entre eux dans l'ordre
     * alphabetique des noms normalises : « epee du bouftou », puis
     * « peau de bouftou ».
     */
    expect(searchItems(INDEX, 'bouf').map((i) => i.id)).toEqual([1, 3, 2])
  })

  it('exige tous les mots de la requête', () => {
    expect(searchItems(INDEX, 'peau bouftou').map((i) => i.id)).toEqual([2])
  })

  it('ignore lordre des mots', () => {
    expect(searchItems(INDEX, 'bouftou peau').map((i) => i.id)).toEqual([2])
  })

  it('nrenvoie rien en deçà de deux caractères', () => {
    // Sinon la premiere frappe deroulerait des centaines de lignes.
    expect(MIN_QUERY_LENGTH).toBe(2)
    expect(searchItems(INDEX, 'b')).toEqual([])
    expect(searchItems(INDEX, '')).toEqual([])
    expect(searchItems(INDEX, '   ')).toEqual([])
  })

  it('respecte la limite de résultats', () => {
    const many = indexItems(
      Array.from({ length: 200 }, (_, i) => item(i + 100, `Bouftou ${i}`)),
    )
    expect(searchItems(many, 'bouftou', 25)).toHaveLength(25)
  })

  it('renvoie une liste vide quand rien ne correspond', () => {
    expect(searchItems(INDEX, 'zaap')).toEqual([])
  })
})
