import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeItem, type RawItem } from '../src/catalog/normalize'
import type { Catalog, Item, Recipe } from '../src/catalog/types'

const VERSION = 'v1'
const SOURCES = ['allequipments', 'allweapons', 'resource', 'consumable']

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

const catalog: Catalog = { version: VERSION, items, recipes }
mkdirSync('public', { recursive: true })
writeFileSync(join('public', `catalog.${VERSION}.json`), JSON.stringify(catalog))

console.log(`\nCatalogue ${VERSION}`)
console.log(`  objets            : ${items.length}`)
console.log(`  recettes          : ${recipes.length}`)
console.log(`  métier inconnu    : ${unknownJob}`)
console.log(`  ingrédients orphelins : ${orphans.size}`)
if (orphans.size) console.log(`  identifiants : ${[...orphans].slice(0, 20).join(', ')}…`)
