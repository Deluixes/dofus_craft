import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeItem, type RawItem } from '../src/catalog/normalize'
import type { Catalog, Item, Recipe } from '../src/catalog/types'

const VERSION = 'v1'

/*
 * `pet` et `mount` complètent les quatre sources d'origine : les familiers et
 * surtout les dragodindes se commercent beaucoup, et le registre de négoce doit
 * pouvoir les nommer. Ils n'apportent aucune recette (ils ne se craftent pas).
 * `set.json` reste volontairement absent : une panoplie n'est pas un objet
 * échangeable.
 */
const SOURCES = ['allequipments', 'allweapons', 'resource', 'consumable', 'pet', 'mount']

const items: Item[] = []
const recipes: Recipe[] = []
const seen = new Set<number>()

for (const source of SOURCES) {
  const path = join('data', 'dofus-touch', `${source}.json`)
  const raw = JSON.parse(readFileSync(path, 'utf8')) as RawItem[]
  for (const entry of raw) {
    if (seen.has(entry._id)) continue
    seen.add(entry._id)
    const { item, recipe } = normalizeItem(entry)
    items.push(item)
    if (recipe) recipes.push(recipe)
  }
  console.log(`${source}: ${raw.length} objets lus`)
}

// Un ingrédient absent du catalogue rendrait sa recette définitivement
// incalculable : on le signale plutôt que de le laisser passer.
const orphans = new Set<number>()
for (const recipe of recipes) {
  for (const ing of recipe.ingredients) {
    if (!seen.has(ing.itemId)) orphans.add(ing.itemId)
  }
}

const unknownJob = recipes.filter((r) => r.job === 'inconnu').length

console.log(`\nCatalogue ${VERSION}`)
console.log(`  objets            : ${items.length}`)
console.log(`  recettes          : ${recipes.length}`)
console.log(`  métier inconnu    : ${unknownJob}`)
console.log(`  ingrédients orphelins : ${orphans.size}`)
if (orphans.size) console.log(`  identifiants : ${[...orphans].slice(0, 20).join(', ')}…`)

/*
 * Garde-fous. Les sources `data/dofus-touch/*.json` sont committées, mais rien
 * n'empêche un fichier tronqué (téléchargement partiel, mauvaise fusion) de
 * produire un catalogue amputé — et un catalogue amputé ne se voit pas : il
 * livre une application qui démarre et affiche moins de crafts, sans jamais
 * dire lesquels manquent. Le build doit donc s'arrêter, et non se contenter
 * d'afficher des compteurs que personne ne lit. Les seuils sont volontairement
 * très en dessous des volumes réels (6519 objets, 2219 recettes) : ils
 * n'attrapent qu'une amputation franche, pas une variation de version amont.
 *
 * `MIN_ITEMS` suit l'ajout de pet et mount : laissé à 5000, il n'aurait plus
 * détecté la perte d'un fichier source entier.
 */
const MIN_ITEMS = 6000
const MIN_RECIPES = 1500

if (items.length < MIN_ITEMS || recipes.length < MIN_RECIPES) {
  console.error(
    `\nÉCHEC : catalogue tronqué — ${items.length} objets (minimum ${MIN_ITEMS}) et ` +
      `${recipes.length} recettes (minimum ${MIN_RECIPES}).\n` +
      'Vérifie que les quatre fichiers de data/dofus-touch/ sont complets. ' +
      "Aucun catalogue n'a été écrit.",
  )
  process.exit(1)
}

const catalog: Catalog = { version: VERSION, items, recipes }
mkdirSync('public', { recursive: true })
writeFileSync(join('public', `catalog.${VERSION}.json`), JSON.stringify(catalog))
console.log(`\nÉcrit : public/catalog.${VERSION}.json`)
