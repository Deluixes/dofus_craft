import type { Item } from '../catalog/types'

/**
 * Recherche d'objet pour la saisie assistée.
 *
 * Filtrage linéaire, sans index ni bibliothèque de recherche floue. Mesuré sur
 * les 6519 objets du catalogue, un filtre complet coûte moins d'une
 * milliseconde sur un poste de bureau, soit quelques millisecondes sur un
 * téléphone — très en dessous du budget d'une frame. Un index par préfixe
 * serait une structure à construire et à maintenir pour gagner ces
 * millisecondes-là.
 *
 * Le flou est écarté volontairement : en cherchant « bouftou », on ne veut pas
 * « boufton » en tête de liste.
 */

/** Minuscules et sans accents : « Épée du Bouftou » devient « epee du bouftou ». */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Longueur en deçà de laquelle on n'affiche rien, pour ne pas noyer l'écran. */
export const MIN_QUERY_LENGTH = 2

export interface SearchableItem {
  item: Item
  key: string
}

/** Prépare les clés de recherche une fois pour toutes, au chargement du catalogue. */
export function indexItems(items: Iterable<Item>): SearchableItem[] {
  return [...items]
    .map((item) => ({ item, key: normalize(item.name) }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * Objets dont le nom contient tous les mots de la requête.
 *
 * Les correspondances en début de nom passent devant : en tapant « bouf », on
 * cherche « Bouftou » avant « Peau de Bouftou ». À l'intérieur de chaque
 * groupe, l'ordre alphabétique est déjà celui de l'index.
 */
export function searchItems(index: SearchableItem[], query: string, max = 25): Item[] {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean)
  if (words.length === 0 || query.trim().length < MIN_QUERY_LENGTH) return []

  const starting: Item[] = []
  const containing: Item[] = []

  for (const entry of index) {
    if (!words.every((word) => entry.key.includes(word))) continue
    if (entry.key.startsWith(words[0])) starting.push(entry.item)
    else containing.push(entry.item)
    if (starting.length >= max) break
  }

  return [...starting, ...containing].slice(0, max)
}
