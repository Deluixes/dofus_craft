# Krosmarge — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une PWA hors-ligne qui classe les crafts Dofus Touch par marge nette réelle, à partir d'un catalogue pré-chargé et de prix HDV saisis à la main.

**Architecture:** Quatre couches strictement séparées. `catalog/` contient les données de jeu générées au build (lecture seule). `domain/` contient les calculs, purs et sans I/O, développés en TDD. `store/` encapsule IndexedDB derrière des interfaces de dépôt. `ui/` contient les écrans React. La règle non négociable : `domain/` n'importe jamais React ni Dexie.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4.3, Dexie (IndexedDB), Vitest, vite-plugin-pwa v1.2.

**Spécification de référence :** `docs/superpowers/specs/2026-07-27-krosmarge-design.md`

## Global Constraints

Ces règles s'appliquent à **toutes** les tâches. Les valeurs sont reprises telles quelles de la spec.

- **Taxe HDV : 2 % (`0.02`), prélevée à la mise en vente**, pas à la vente.
- **Tailles de lot autorisées : `1 | 10 | 100`** — aucune autre valeur n'est valide.
- **Durée d'une vente : 14 jours** exactement.
- **Seuils de fraîcheur par défaut : 24 h (frais) / 72 h (périmé)**, configurables.
- **`domain/` n'importe ni React ni Dexie ni aucune API navigateur.** Toute fonction du domaine est pure et reçoit `now: number` en paramètre plutôt que d'appeler `Date.now()`.
- **Aucune marge affichée sans indice de confiance.** Une valeur manquante n'est jamais remplacée par une estimation silencieuse.
- **La marge par pod est interdite** — le dataset ne contient pas le poids en pods.
- **Aucun backend, aucun compte, aucun appel réseau au runtime** hors chargement des icônes.
- **Langue de l'interface : français.**
- **Tailwind v4.3 ne prend pas de `tailwind.config.js`.** La configuration passe par le plugin Vite et `@import "tailwindcss"`. Ne pas créer de fichier de config Tailwind ni de globs `content`.
- Chaque tâche se termine par un commit. Message en français, préfixe conventionnel (`feat:`, `test:`, `chore:`, `docs:`).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `scripts/build-catalog.ts` | Lecture des JSON bruts, appel des fonctions de normalisation, écriture du catalogue |
| `src/catalog/types.ts` | Types du catalogue : `Job`, `Item`, `Recipe`, `Catalog`, `CatalogIndex` |
| `src/catalog/jobMapping.ts` | Table type → métier et sa fonction de résolution |
| `src/catalog/normalize.ts` | Conversion des structures brutes dofapi en types propres (fonctions pures) |
| `src/catalog/statWeights.ts` | Poids des statistiques et références de runes (données de référence) |
| `src/catalog/loadCatalog.ts` | Chargement du catalogue et construction des index runtime |
| `src/domain/types.ts` | `LotSize`, `PriceEntry`, `PriceBook`, `Freshness`, `FreshnessConfig` |
| `src/domain/price.ts` | Prix unitaire à partir d'un relevé et de sa taille de lot |
| `src/domain/craftCost.ts` | Coût de craft, lignes de détail, ingrédients sans prix |
| `src/domain/margin.ts` | Taxe, marge nette, pourcentage de marge |
| `src/domain/freshness.ts` | Niveaux de fraîcheur et propagation au craft |
| `src/domain/surveyPriority.ts` | Ordre de la file de relevé guidé |
| `src/domain/breaking.ts` | Estimation de la valeur de brisage |
| `src/domain/sale.ts` | Création d'une vente, expiration, profit réalisé |
| `src/store/db.ts` | Schéma Dexie |
| `src/store/repositories.ts` | Dépôts prix / ventes / réglages |
| `src/ui/App.tsx` | Racine, routage par onglet |
| `src/ui/shell/BottomNav.tsx` | Barre d'onglets basse |
| `src/ui/components/*` | `FreshnessDot`, `LotSelector`, `NumericKeypad`, `KamasAmount` |
| `src/ui/screens/*` | `CraftsScreen`, `CraftDetailScreen`, `PricesScreen`, `SalesScreen`, `SettingsScreen` |

Les tests sont colocalisés : `src/domain/price.test.ts` à côté de `src/domain/price.ts`.

---

## Écart assumé par rapport à la spec

La spec §6.3 définit l'impact d'un objet comme sa part dans le **coût** des recettes qui le contiennent. Prise au pied de la lettre, cette définition exclut les **objets résultat** de la file de relevé — or leur prix de vente est indispensable au calcul de marge (§6.1). Une file qui ne les contient pas ne permettrait jamais d'obtenir une seule marge.

**Décision :** les objets résultat entrent dans la file avec un impact de `1.0` par recette craftable. La tâche 8 l'implémente et le teste explicitement.

---

## Task 1: Échafaudage et première fonction de domaine

Le prix unitaire sert de fonction témoin : elle prouve que la chaîne complète (TypeScript, Vitest, exécution des tests) fonctionne avant qu'on écrive quoi que ce soit de sérieux.

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/index.css`
- Create: `src/domain/types.ts`, `src/domain/price.ts`
- Test: `src/domain/price.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: `LotSize`, `PriceEntry`, `PriceBook`, `FreshnessConfig` (dans `src/domain/types.ts`) ; `unitPrice(entry: PriceEntry): number` (dans `src/domain/price.ts`)

- [ ] **Step 1: Initialiser le projet et installer les dépendances**

```bash
npm create vite@latest . -- --template react-ts
npm install dexie
npm install -D tailwindcss @tailwindcss/vite vitest jsdom \
  @testing-library/react @testing-library/jest-dom fake-indexeddb tsx vite-plugin-pwa
```

Si `npm create vite` refuse d'écrire dans un dossier non vide, répondre « Ignore files and continue » : `.git`, `.gitignore` et `docs/` doivent être conservés.

- [ ] **Step 2: Configurer Vite, Tailwind et Vitest**

`vite.config.ts` :

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

`src/test-setup.ts` :

```typescript
import '@testing-library/jest-dom/vitest'
```

`src/index.css` — remplacer intégralement le contenu généré par Vite :

```css
@import "tailwindcss";
```

Ajouter les scripts dans `package.json` :

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Ne créer aucun `tailwind.config.js` : Tailwind v4.3 n'en utilise pas.

- [ ] **Step 3: Écrire les types du domaine**

`src/domain/types.ts` :

```typescript
export type LotSize = 1 | 10 | 100

export interface PriceEntry {
  itemId: number
  kamas: number
  lotSize: LotSize
  observedAt: number
}

/** Dernier prix relevé, indexé par identifiant d'objet. */
export type PriceBook = Map<number, PriceEntry>

export type Freshness = 'fresh' | 'stale' | 'expired' | 'missing'

export interface FreshnessConfig {
  freshHours: number
  staleHours: number
}
```

- [ ] **Step 4: Écrire le test qui échoue**

`src/domain/price.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { unitPrice } from './price'
import type { PriceEntry } from './types'

const entry = (kamas: number, lotSize: 1 | 10 | 100): PriceEntry => ({
  itemId: 1, kamas, lotSize, observedAt: 0,
})

describe('unitPrice', () => {
  it('renvoie le montant tel quel pour un lot de 1', () => {
    expect(unitPrice(entry(4500, 1))).toBe(4500)
  })

  it('divise par 10 pour un lot de 10', () => {
    expect(unitPrice(entry(45000, 10))).toBe(4500)
  })

  it('divise par 100 pour un lot de 100', () => {
    expect(unitPrice(entry(45000, 100))).toBe(450)
  })

  it('gère les prix unitaires non entiers sans arrondir', () => {
    expect(unitPrice(entry(101, 100))).toBeCloseTo(1.01, 5)
  })
})
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- price`
Attendu : ÉCHEC, `Failed to resolve import "./price"`

- [ ] **Step 6: Écrire l'implémentation minimale**

`src/domain/price.ts` :

```typescript
import type { PriceEntry } from './types'

/**
 * Prix d'une unité à partir d'un relevé HDV.
 * Le joueur saisit le montant du lot tel qu'affiché en jeu ; la division
 * est faite ici pour lui éviter un calcul mental source d'erreurs.
 */
export function unitPrice(entry: PriceEntry): number {
  return entry.kamas / entry.lotSize
}
```

- [ ] **Step 7: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test`
Attendu : SUCCÈS, 4 tests

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: échafaudage Vite/React/Tailwind/Vitest et prix unitaire par lot"
```

---

## Task 2: Table type → métier

**Files:**
- Create: `src/catalog/types.ts`, `src/catalog/jobMapping.ts`
- Test: `src/catalog/jobMapping.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: `Job`, `StatRange`, `Ingredient`, `Item`, `Recipe`, `Catalog`, `CatalogIndex` (dans `src/catalog/types.ts`) ; `TYPE_TO_JOB: Record<string, Job>` et `jobForType(type: string): Job` (dans `src/catalog/jobMapping.ts`)

- [ ] **Step 1: Écrire les types du catalogue**

`src/catalog/types.ts` :

```typescript
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
```

- [ ] **Step 2: Écrire le test qui échoue**

`src/catalog/jobMapping.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { jobForType, TYPE_TO_JOB } from './jobMapping'

describe('jobForType', () => {
  it('attribue Bouclier et Trophée au Façonneur', () => {
    // Dérivé de 4858 recettes dofusdb : pureté 99 % et 100 %.
    // Erreur classique : les attribuer au Bricoleur.
    expect(jobForType('Bouclier')).toBe('faconneur')
    expect(jobForType('Trophée')).toBe('faconneur')
  })

  it("n'attribue aucun équipement au Bricoleur", () => {
    const equipmentTypes = ['Bouclier', 'Trophée', 'Chapeau', 'Cape', 'Anneau']
    for (const type of equipmentTypes) {
      expect(jobForType(type)).not.toBe('bricoleur')
    }
  })

  it('attribue les armes lourdes au Forgeron', () => {
    for (const type of ['Épée', 'Dague', 'Marteau', 'Hache', 'Pelle', 'Faux']) {
      expect(jobForType(type)).toBe('forgeron')
    }
  })

  it('attribue les armes en bois au Sculpteur', () => {
    for (const type of ['Arc', 'Baguette', 'Bâton']) {
      expect(jobForType(type)).toBe('sculpteur')
    }
  })

  it('attribue les types du Tailleur, du Bijoutier et du Cordonnier', () => {
    expect(jobForType('Chapeau')).toBe('tailleur')
    expect(jobForType('Cape')).toBe('tailleur')
    expect(jobForType('Anneau')).toBe('bijoutier')
    expect(jobForType('Amulette')).toBe('bijoutier')
    expect(jobForType('Bottes')).toBe('cordonnier')
    expect(jobForType('Ceinture')).toBe('cordonnier')
  })

  it('renvoie inconnu pour un type absent de la table', () => {
    expect(jobForType('Sac à dos')).toBe('inconnu')
    expect(jobForType('Type qui nexiste pas')).toBe('inconnu')
  })

  it('ne contient aucune entrée pointant vers inconnu', () => {
    for (const [type, job] of Object.entries(TYPE_TO_JOB)) {
      expect(job, `${type} ne doit pas être mappé explicitement sur inconnu`).not.toBe('inconnu')
    }
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- jobMapping`
Attendu : ÉCHEC, `Failed to resolve import "./jobMapping"`

- [ ] **Step 4: Écrire l'implémentation**

`src/catalog/jobMapping.ts` :

```typescript
import type { Job } from './types'

/**
 * Type d'objet → métier qui le fabrique.
 *
 * Table dérivée empiriquement en agrégeant les 4858 recettes de
 * api.dofusdb.fr, qui expose `resultTypeId` et `jobId`. Pureté de 94 % à
 * 100 % sur tous les types retenus. Les types dont la pureté est trop
 * faible ou absents des données (Sac à dos, Pioche, Outil) sont
 * volontairement omis et retombent sur `inconnu`.
 */
export const TYPE_TO_JOB: Record<string, Job> = {
  // Tailleur
  'Chapeau': 'tailleur',
  'Cape': 'tailleur',
  // Bijoutier
  'Anneau': 'bijoutier',
  'Amulette': 'bijoutier',
  // Cordonnier
  'Bottes': 'cordonnier',
  'Ceinture': 'cordonnier',
  // Façonneur — et non Bricoleur
  'Trophée': 'faconneur',
  'Bouclier': 'faconneur',
  // Forgeron
  'Épée': 'forgeron',
  'Dague': 'forgeron',
  'Marteau': 'forgeron',
  'Hache': 'forgeron',
  'Pelle': 'forgeron',
  'Faux': 'forgeron',
  'Lance': 'forgeron',
  // Sculpteur
  'Arc': 'sculpteur',
  'Baguette': 'sculpteur',
  'Bâton': 'sculpteur',
  // Bricoleur — clés et prismes, aucun équipement
  'Clef': 'bricoleur',
  'Prisme': 'bricoleur',
  // Alchimiste
  'Potion': 'alchimiste',
  'Boisson': 'alchimiste',
  'Teinture': 'alchimiste',
  'Préparation': 'alchimiste',
  'Potion de téléportation': 'alchimiste',
  'Potion de forgemagie': 'alchimiste',
  // Paysan
  'Pain': 'paysan',
  'Friandise': 'paysan',
  'Huile': 'paysan',
  // Pêcheur / Chasseur
  'Poisson comestible': 'pecheur',
  'Viande comestible': 'chasseur',
  // Bûcheron / Mineur
  'Planche': 'bucheron',
  'Substrat': 'bucheron',
  'Alliage': 'mineur',
  "Pierre d'âme": 'mineur',
}

/** Métier fabriquant ce type d'objet, `inconnu` si non déterminé. */
export function jobForType(type: string): Job {
  return TYPE_TO_JOB[type] ?? 'inconnu'
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- jobMapping`
Attendu : SUCCÈS, 7 tests

- [ ] **Step 6: Commit**

```bash
git add src/catalog/
git commit -m "feat: table type vers métier dérivée des données dofusdb"
```

---

## Task 3: Normalisation des données brutes

Les JSON dofapi utilisent des structures pénibles — tableaux d'objets à clé unique, nombres stockés en chaînes, champs optionnels. Cette tâche isole la conversion dans des fonctions pures testables, pour que le script de build (tâche 4) ne contienne que de l'I/O.

**Files:**
- Create: `src/catalog/normalize.ts`
- Test: `src/catalog/normalize.test.ts`

**Interfaces:**
- Consumes: `StatRange`, `Ingredient`, `Item`, `Recipe`, `Job` de `src/catalog/types.ts` ; `jobForType` de `src/catalog/jobMapping.ts`
- Produces: `RawItem`, `RawStatEntry`, `RawRecipeEntry`, `normalizeStats`, `normalizeIngredients`, `normalizeItem`

- [ ] **Step 1: Écrire le test qui échoue**

`src/catalog/normalize.test.ts` :

```typescript
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
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- normalize`
Attendu : ÉCHEC, `Failed to resolve import "./normalize"`

- [ ] **Step 3: Écrire l'implémentation**

`src/catalog/normalize.ts` :

```typescript
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
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- normalize`
Attendu : SUCCÈS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/catalog/normalize.ts src/catalog/normalize.test.ts
git commit -m "feat: normalisation des structures brutes dofapi"
```

---

## Task 4: Génération et chargement du catalogue

**Files:**
- Create: `scripts/build-catalog.ts`, `src/catalog/loadCatalog.ts`
- Create: `data/dofus-touch/` (quatre JSON téléchargés)
- Test: `src/catalog/loadCatalog.test.ts`
- Modify: `package.json` (script `build:catalog`)

**Interfaces:**
- Consumes: `normalizeItem` de `src/catalog/normalize.ts` ; `Catalog`, `CatalogIndex` de `src/catalog/types.ts`
- Produces: `buildCatalogIndex(catalog: Catalog): CatalogIndex` et `loadCatalog(url?: string): Promise<CatalogIndex>` (dans `src/catalog/loadCatalog.ts`) ; l'artefact `public/catalog.v1.json`

- [ ] **Step 1: Télécharger les données brutes**

```bash
mkdir -p data/dofus-touch
BASE=https://raw.githubusercontent.com/dofapi/crawlit-dofus-encyclopedia-parser/master/data/dofus-touch
for f in allequipments allweapons resource consumable; do
  curl -sL -o "data/dofus-touch/$f.json" "$BASE/$f.json"
done
wc -c data/dofus-touch/*.json
```

Attendu, aux octets près : `allequipments.json` ≈ 2 967 771, `allweapons.json` ≈ 1 607 143, `resource.json` ≈ 1 096 107, `consumable.json` ≈ 1 025 158.

Ces fichiers **sont versionnés dans git** : la source amont peut disparaître, et le catalogue doit rester reconstructible. Vérifier que `.gitignore` ne les exclut pas.

- [ ] **Step 2: Écrire le script de génération**

`scripts/build-catalog.ts` :

```typescript
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
```

Ajouter à `package.json` :

```json
{ "scripts": { "build:catalog": "tsx scripts/build-catalog.ts" } }
```

- [ ] **Step 3: Exécuter le script**

Lancer : `npm run build:catalog`
Attendu : environ 6 300 objets et 2 200 recettes. Le nombre exact peut varier — la source évolue. Un compte inférieur à 5 000 objets ou 1 500 recettes indique un téléchargement incomplet, à investiguer avant de continuer.

- [ ] **Step 4: Écrire le test qui échoue**

`src/catalog/loadCatalog.test.ts` :

```typescript
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
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- loadCatalog`
Attendu : ÉCHEC, `Failed to resolve import "./loadCatalog"`

- [ ] **Step 6: Écrire l'implémentation**

`src/catalog/loadCatalog.ts` :

```typescript
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
```

- [ ] **Step 7: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test`
Attendu : SUCCÈS, tous les tests

- [ ] **Step 8: Commit**

```bash
git add data/ scripts/ src/catalog/loadCatalog.ts src/catalog/loadCatalog.test.ts package.json
git commit -m "feat: génération du catalogue Touch et index runtime"
```

---

## Task 5: Coût de craft

**Files:**
- Create: `src/domain/craftCost.ts`
- Test: `src/domain/craftCost.test.ts`

**Interfaces:**
- Consumes: `unitPrice` de `src/domain/price.ts` ; `PriceBook` de `src/domain/types.ts` ; `Recipe` de `src/catalog/types.ts`
- Produces: `CostLine`, `CraftCost`, `craftCost(recipe: Recipe, prices: PriceBook): CraftCost`

- [ ] **Step 1: Écrire le test qui échoue**

`src/domain/craftCost.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { craftCost } from './craftCost'
import type { PriceBook } from './types'
import type { Recipe } from '../catalog/types'

const recipe: Recipe = {
  resultItemId: 100,
  job: 'tailleur',
  ingredients: [{ itemId: 2, quantity: 3 }, { itemId: 3, quantity: 5 }],
}

const book = (entries: Array<[number, number, 1 | 10 | 100]>): PriceBook =>
  new Map(entries.map(([itemId, kamas, lotSize]) => [
    itemId, { itemId, kamas, lotSize, observedAt: 0 },
  ]))

describe('craftCost', () => {
  it('somme les sous-totaux quand tous les prix sont connus', () => {
    const result = craftCost(recipe, book([[2, 100, 1], [3, 5000, 100]]))
    // 3 × 100 + 5 × 50 = 550
    expect(result.total).toBe(550)
    expect(result.missingItemIds).toEqual([])
  })

  it('détaille chaque ligne avec son prix unitaire et son sous-total', () => {
    const result = craftCost(recipe, book([[2, 100, 1], [3, 5000, 100]]))
    expect(result.lines).toEqual([
      { itemId: 2, quantity: 3, unitPrice: 100, subtotal: 300 },
      { itemId: 3, quantity: 5, unitPrice: 50, subtotal: 250 },
    ])
  })

  it('rend le total indéfini dès quun seul prix manque', () => {
    const result = craftCost(recipe, book([[2, 100, 1]]))
    expect(result.total).toBeNull()
    expect(result.missingItemIds).toEqual([3])
  })

  it('liste tous les ingrédients manquants, pas seulement le premier', () => {
    const result = craftCost(recipe, book([]))
    expect(result.missingItemIds).toEqual([2, 3])
  })

  it('conserve les lignes des ingrédients sans prix pour permettre leur saisie', () => {
    const result = craftCost(recipe, book([[2, 100, 1]]))
    expect(result.lines[1]).toEqual({ itemId: 3, quantity: 5, unitPrice: null, subtotal: null })
  })

  it('renvoie un total nul pour une recette sans ingrédient', () => {
    const empty: Recipe = { resultItemId: 1, job: 'tailleur', ingredients: [] }
    expect(craftCost(empty, book([])).total).toBe(0)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- craftCost`
Attendu : ÉCHEC, `Failed to resolve import "./craftCost"`

- [ ] **Step 3: Écrire l'implémentation**

`src/domain/craftCost.ts` :

```typescript
import type { Recipe } from '../catalog/types'
import { unitPrice } from './price'
import type { PriceBook } from './types'

export interface CostLine {
  itemId: number
  quantity: number
  unitPrice: number | null
  subtotal: number | null
}

export interface CraftCost {
  /** `null` si et seulement si `missingItemIds` n'est pas vide. */
  total: number | null
  lines: CostLine[]
  missingItemIds: number[]
}

/**
 * Coût de production d'un craft.
 *
 * Un seul ingrédient sans prix rend le total indéfini : la spec interdit
 * d'estimer silencieusement une valeur manquante. Les lignes incomplètes
 * sont néanmoins conservées, l'interface s'en sert pour proposer la saisie.
 */
export function craftCost(recipe: Recipe, prices: PriceBook): CraftCost {
  const lines: CostLine[] = []
  const missingItemIds: number[] = []
  let total = 0

  for (const ing of recipe.ingredients) {
    const entry = prices.get(ing.itemId)
    if (!entry) {
      missingItemIds.push(ing.itemId)
      lines.push({ itemId: ing.itemId, quantity: ing.quantity, unitPrice: null, subtotal: null })
      continue
    }
    const unit = unitPrice(entry)
    const subtotal = unit * ing.quantity
    total += subtotal
    lines.push({ itemId: ing.itemId, quantity: ing.quantity, unitPrice: unit, subtotal })
  }

  return { total: missingItemIds.length > 0 ? null : total, lines, missingItemIds }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- craftCost`
Attendu : SUCCÈS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/domain/craftCost.ts src/domain/craftCost.test.ts
git commit -m "feat: calcul du coût de craft avec gestion des prix manquants"
```

---

## Task 6: Taxe et marge

**Files:**
- Create: `src/domain/margin.ts`
- Test: `src/domain/margin.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: `HDV_TAX_RATE`, `saleTax(salePrice: number): number`, `CraftMargin`, `craftMargin(cost: number, salePrice: number): CraftMargin`

- [ ] **Step 1: Écrire le test qui échoue**

`src/domain/margin.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { HDV_TAX_RATE, saleTax, craftMargin } from './margin'

describe('saleTax', () => {
  it('applique un taux de 2 %', () => {
    expect(HDV_TAX_RATE).toBe(0.02)
    expect(saleTax(100_000)).toBe(2000)
  })

  it('renvoie zéro pour un prix nul', () => {
    expect(saleTax(0)).toBe(0)
  })
})

describe('craftMargin', () => {
  it('déduit la taxe et le coût du prix de vente', () => {
    const m = craftMargin(50_000, 100_000)
    expect(m.tax).toBe(2000)
    expect(m.net).toBe(48_000)
    expect(m.pct).toBeCloseTo(0.96, 5)
  })

  it('renvoie une marge négative quand le craft nest pas rentable', () => {
    const m = craftMargin(100_000, 50_000)
    expect(m.net).toBe(-51_000)   // 50000 - 1000 - 100000
    expect(m.pct).toBeCloseTo(-0.51, 5)
  })

  it('rend la taxe visible même quand la marge est négative', () => {
    expect(craftMargin(100_000, 50_000).tax).toBe(1000)
  })

  it('évite une division par zéro quand le coût est nul', () => {
    const m = craftMargin(0, 10_000)
    expect(m.net).toBe(9800)
    expect(m.pct).toBe(0)
  })

  it('reporte le coût et le prix de vente reçus', () => {
    const m = craftMargin(50_000, 100_000)
    expect(m.cost).toBe(50_000)
    expect(m.salePrice).toBe(100_000)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- margin`
Attendu : ÉCHEC, `Failed to resolve import "./margin"`

- [ ] **Step 3: Écrire l'implémentation**

`src/domain/margin.ts` :

```typescript
/** Taxe HDV Dofus Touch, prélevée à la mise en vente et non à la vente. */
export const HDV_TAX_RATE = 0.02

export function saleTax(salePrice: number): number {
  return salePrice * HDV_TAX_RATE
}

export interface CraftMargin {
  cost: number
  salePrice: number
  tax: number
  net: number
  /** Marge nette rapportée au coût. `0` si le coût est nul. */
  pct: number
}

export function craftMargin(cost: number, salePrice: number): CraftMargin {
  const tax = saleTax(salePrice)
  const net = salePrice - tax - cost
  return { cost, salePrice, tax, net, pct: cost === 0 ? 0 : net / cost }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- margin`
Attendu : SUCCÈS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/domain/margin.ts src/domain/margin.test.ts
git commit -m "feat: taxe HDV de 2 pourcent et calcul de marge nette"
```

---

## Task 7: Fraîcheur et confiance

**Files:**
- Create: `src/domain/freshness.ts`
- Test: `src/domain/freshness.test.ts`

**Interfaces:**
- Consumes: `PriceEntry`, `Freshness`, `FreshnessConfig` de `src/domain/types.ts`
- Produces: `DEFAULT_FRESHNESS`, `HOUR_MS`, `freshnessOf(entry, now, cfg?)`, `worstFreshness(list: Freshness[]): Freshness`

- [ ] **Step 1: Écrire le test qui échoue**

`src/domain/freshness.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { freshnessOf, worstFreshness, DEFAULT_FRESHNESS, HOUR_MS } from './freshness'
import type { PriceEntry } from './types'

const NOW = 1_000_000_000_000
const agedBy = (hours: number): PriceEntry =>
  ({ itemId: 1, kamas: 100, lotSize: 1, observedAt: NOW - hours * HOUR_MS })

describe('freshnessOf', () => {
  it('utilise 24 h et 72 h par défaut', () => {
    expect(DEFAULT_FRESHNESS).toEqual({ freshHours: 24, staleHours: 72 })
  })

  it('classe frais en deçà de 24 h', () => {
    expect(freshnessOf(agedBy(0), NOW)).toBe('fresh')
    expect(freshnessOf(agedBy(23.9), NOW)).toBe('fresh')
  })

  it('classe acceptable entre 24 h et 72 h', () => {
    expect(freshnessOf(agedBy(24), NOW)).toBe('stale')
    expect(freshnessOf(agedBy(71.9), NOW)).toBe('stale')
  })

  it('classe périmé au-delà de 72 h', () => {
    expect(freshnessOf(agedBy(72), NOW)).toBe('expired')
    expect(freshnessOf(agedBy(500), NOW)).toBe('expired')
  })

  it('classe manquant en labsence de relevé', () => {
    expect(freshnessOf(undefined, NOW)).toBe('missing')
  })

  it('respecte des seuils personnalisés', () => {
    expect(freshnessOf(agedBy(2), NOW, { freshHours: 1, staleHours: 3 })).toBe('stale')
  })
})

describe('worstFreshness', () => {
  it('retient le niveau le plus dégradé', () => {
    expect(worstFreshness(['fresh', 'stale', 'fresh'])).toBe('stale')
    expect(worstFreshness(['fresh', 'expired', 'stale'])).toBe('expired')
    expect(worstFreshness(['expired', 'missing'])).toBe('missing')
  })

  it('renvoie frais quand tout est frais', () => {
    expect(worstFreshness(['fresh', 'fresh'])).toBe('fresh')
  })

  it('renvoie frais pour une liste vide', () => {
    expect(worstFreshness([])).toBe('fresh')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- freshness`
Attendu : ÉCHEC, `Failed to resolve import "./freshness"`

- [ ] **Step 3: Écrire l'implémentation**

`src/domain/freshness.ts` :

```typescript
import type { Freshness, FreshnessConfig, PriceEntry } from './types'

export const HOUR_MS = 3_600_000

export const DEFAULT_FRESHNESS: FreshnessConfig = { freshHours: 24, staleHours: 72 }

export function freshnessOf(
  entry: PriceEntry | undefined,
  now: number,
  cfg: FreshnessConfig = DEFAULT_FRESHNESS,
): Freshness {
  if (!entry) return 'missing'
  const ageHours = (now - entry.observedAt) / HOUR_MS
  if (ageHours < cfg.freshHours) return 'fresh'
  if (ageHours < cfg.staleHours) return 'stale'
  return 'expired'
}

const RANK: Record<Freshness, number> = { fresh: 0, stale: 1, expired: 2, missing: 3 }

/**
 * Confiance d'un ensemble de prix : un craft n'est pas plus fiable que sa
 * donnée la plus faible. Une liste vide vaut `fresh`, cas qui ne se produit
 * pas en pratique (toute recette a au moins un ingrédient).
 */
export function worstFreshness(list: Freshness[]): Freshness {
  return list.reduce<Freshness>((worst, f) => (RANK[f] > RANK[worst] ? f : worst), 'fresh')
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- freshness`
Attendu : SUCCÈS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/domain/freshness.ts src/domain/freshness.test.ts
git commit -m "feat: niveaux de fraîcheur des prix et propagation de la confiance"
```

---

## Task 8: Priorité du relevé guidé

C'est le calcul qui détermine si l'application est utilisable au quotidien. Deux pièges à éviter, tous deux couverts par les tests : fonder l'impact sur la rentabilité (file vide au premier lancement) et oublier les objets résultat (aucune marge jamais calculable).

**Files:**
- Create: `src/domain/surveyPriority.ts`
- Test: `src/domain/surveyPriority.test.ts`

**Interfaces:**
- Consumes: `CatalogIndex`, `Job`, `Recipe` de `src/catalog/types.ts` ; `PriceBook`, `FreshnessConfig` de `src/domain/types.ts` ; `unitPrice` de `src/domain/price.ts` ; `HOUR_MS`, `DEFAULT_FRESHNESS` de `src/domain/freshness.ts`
- Produces: `MISSING_OBSOLESCENCE`, `JobLevels`, `canCraft(recipe, index, jobLevels)`, `PriorityEntry`, `surveyPriority(index, prices, jobLevels, now, cfg?)`

- [ ] **Step 1: Écrire le test qui échoue**

`src/domain/surveyPriority.test.ts` :

```typescript
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
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- surveyPriority`
Attendu : ÉCHEC, `Failed to resolve import "./surveyPriority"`

- [ ] **Step 3: Écrire l'implémentation**

`src/domain/surveyPriority.ts` :

```typescript
import type { CatalogIndex, Job, Recipe } from '../catalog/types'
import { DEFAULT_FRESHNESS, HOUR_MS } from './freshness'
import { unitPrice } from './price'
import type { FreshnessConfig, PriceBook } from './types'

/**
 * Obsolescence forfaitaire d'un prix jamais relevé. Volontairement très
 * supérieure à 1 pour qu'un prix absent passe devant un prix simplement vieux.
 */
export const MISSING_OBSOLESCENCE = 10

export type JobLevels = Partial<Record<Job, number>>

export interface PriorityEntry {
  itemId: number
  impact: number
  obsolescence: number
  priority: number
  affectedRecipeCount: number
}

/** Règle Dofus : le niveau de métier doit atteindre le niveau de l'objet produit. */
export function canCraft(recipe: Recipe, index: CatalogIndex, jobLevels: JobLevels): boolean {
  const item = index.itemsById.get(recipe.resultItemId)
  if (!item) return false
  return (jobLevels[recipe.job] ?? 0) >= item.level
}

function obsolescenceOf(prices: PriceBook, itemId: number, now: number, cfg: FreshnessConfig): number {
  const entry = prices.get(itemId)
  if (!entry) return MISSING_OBSOLESCENCE
  return (now - entry.observedAt) / (cfg.staleHours * HOUR_MS)
}

/**
 * Ordonne les prix à relever.
 *
 * L'ensemble de référence est celui des recettes que les niveaux de métier
 * autorisent, et non celui des recettes rentables : au premier lancement
 * aucun prix n'est connu, donc aucune rentabilité n'est calculable, et fonder
 * l'impact sur elle produirait une file vide.
 *
 * Les objets résultat sont inclus avec un impact de 1 par recette : leur prix
 * de vente conditionne l'intégralité du calcul de marge.
 */
export function surveyPriority(
  index: CatalogIndex,
  prices: PriceBook,
  jobLevels: JobLevels,
  now: number,
  cfg: FreshnessConfig = DEFAULT_FRESHNESS,
): PriorityEntry[] {
  const impact = new Map<number, number>()
  const recipeCount = new Map<number, number>()

  const bump = (itemId: number, share: number) => {
    impact.set(itemId, (impact.get(itemId) ?? 0) + share)
    recipeCount.set(itemId, (recipeCount.get(itemId) ?? 0) + 1)
  }

  for (const recipe of index.recipeByResultId.values()) {
    if (!canCraft(recipe, index, jobLevels)) continue

    const subtotals = recipe.ingredients.map((ing) => {
      const entry = prices.get(ing.itemId)
      return entry ? unitPrice(entry) * ing.quantity : null
    })
    const complete = subtotals.every((s) => s !== null)
    const total = complete ? subtotals.reduce((a, b) => a! + b!, 0)! : 0

    recipe.ingredients.forEach((ing, i) => {
      const share = complete && total > 0
        ? subtotals[i]! / total
        : 1 / recipe.ingredients.length
      bump(ing.itemId, share)
    })

    bump(recipe.resultItemId, 1)
  }

  const entries: PriorityEntry[] = []
  for (const [itemId, imp] of impact) {
    const obsolescence = obsolescenceOf(prices, itemId, now, cfg)
    entries.push({
      itemId,
      impact: imp,
      obsolescence,
      priority: imp * obsolescence,
      affectedRecipeCount: recipeCount.get(itemId) ?? 0,
    })
  }

  return entries.sort((a, b) => b.priority - a.priority)
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- surveyPriority`
Attendu : SUCCÈS, 11 tests

- [ ] **Step 5: Commit**

```bash
git add src/domain/surveyPriority.ts src/domain/surveyPriority.test.ts
git commit -m "feat: ordonnancement de la file de relevé par impact et obsolescence"
```

---

## Task 9: Estimation de brisage

**Files:**
- Create: `src/catalog/statWeights.ts`, `src/domain/breaking.ts`
- Test: `src/domain/breaking.test.ts`

**Interfaces:**
- Consumes: `PriceBook` de `src/domain/types.ts` ; `unitPrice` de `src/domain/price.ts` ; `StatRange` de `src/catalog/types.ts`
- Produces: `RuneRef`, `STAT_WEIGHTS`, `RUNES` (dans `src/catalog/statWeights.ts`) ; `Jet`, `averageJets`, `BreakingLine`, `BreakingEstimate`, `breakingValue` (dans `src/domain/breaking.ts`)

- [ ] **Step 1: Écrire les données de référence**

`src/catalog/statWeights.ts` :

```typescript
/**
 * Poids (densité) des statistiques et runes correspondantes.
 *
 * ATTENTION : ces valeurs ne proviennent d'aucune des sources de données
 * vérifiées ; elles sont issues des tables publiées par la communauté. Elles
 * sont le maillon faible du module de brisage et restent corrigeables depuis
 * les réglages. Aucune autre partie de l'application n'en dépend.
 *
 * `runeItemId` référence l'objet rune dans le catalogue. La valeur `0` marque
 * une rune dont l'identifiant reste à rapprocher du catalogue ; ces stats sont
 * ignorées par le calcul tant que l'identifiant n'est pas renseigné.
 */
export interface RuneRef {
  statName: string
  runeItemId: number
  /** Poids d'une rune de cette statistique. */
  runeWeight: number
}

export const STAT_WEIGHTS: Record<string, number> = {
  'Vitalité': 1,
  'Sagesse': 3,
  'Force': 1,
  'Intelligence': 1,
  'Chance': 1,
  'Agilité': 1,
  'Initiative': 0.1,
  'Prospection': 3,
  'Puissance': 2,
  'Dommages': 15,
  'Dommages Critiques': 10,
  'Soins': 10,
  'PA': 100,
  'PM': 90,
  'PO': 51,
  'Invocation': 30,
}

export const RUNES: RuneRef[] = [
  { statName: 'Vitalité', runeItemId: 0, runeWeight: 1 },
  { statName: 'Sagesse', runeItemId: 0, runeWeight: 3 },
  { statName: 'Force', runeItemId: 0, runeWeight: 1 },
  { statName: 'Intelligence', runeItemId: 0, runeWeight: 1 },
  { statName: 'Chance', runeItemId: 0, runeWeight: 1 },
  { statName: 'Agilité', runeItemId: 0, runeWeight: 1 },
  { statName: 'Puissance', runeItemId: 0, runeWeight: 2 },
  { statName: 'Dommages', runeItemId: 0, runeWeight: 15 },
  { statName: 'PA', runeItemId: 0, runeWeight: 100 },
  { statName: 'PM', runeItemId: 0, runeWeight: 90 },
]
```

Les `runeItemId` seront renseignés à la tâche 17 depuis les réglages ; le calcul les ignore tant qu'ils valent `0`, ce que la tâche 9 teste explicitement.

- [ ] **Step 2: Écrire le test qui échoue**

`src/domain/breaking.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { breakingValue, averageJets } from './breaking'
import type { RuneRef } from '../catalog/statWeights'
import type { PriceBook } from './types'

const weights = { 'Vitalité': 1, 'Force': 1, 'PO': 51 }
const runes: RuneRef[] = [
  { statName: 'Vitalité', runeItemId: 900, runeWeight: 1 },
  { statName: 'Force', runeItemId: 901, runeWeight: 1 },
]
const prices: PriceBook = new Map([
  [900, { itemId: 900, kamas: 10, lotSize: 1, observedAt: 0 }],
  [901, { itemId: 901, kamas: 200, lotSize: 1, observedAt: 0 }],
])

describe('averageJets', () => {
  it('prend la moyenne des bornes de chaque statistique', () => {
    expect(averageJets([{ name: 'Vitalité', min: 351, max: 400 }]))
      .toEqual([{ name: 'Vitalité', value: 375.5 }])
  })

  it('renvoie la valeur exacte quand les bornes sont égales', () => {
    expect(averageJets([{ name: 'PO', min: 1, max: 1 }]))
      .toEqual([{ name: 'PO', value: 1 }])
  })
})

describe('breakingValue', () => {
  it('valorise chaque statistique par sa rune', () => {
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, runes, prices)
    // 100 × poids 1 × taux 1 / poids rune 1 = 100 runes × 10 kamas
    expect(r.total).toBe(1000)
  })

  it('cumule plusieurs statistiques', () => {
    const r = breakingValue(
      [{ name: 'Vitalité', value: 100 }, { name: 'Force', value: 50 }],
      weights, runes, prices,
    )
    expect(r.total).toBe(1000 + 50 * 200)
  })

  it('applique le taux de brisage', () => {
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, runes, prices, 1.5)
    expect(r.total).toBe(1500)
  })

  it('ignore les statistiques sans rune correspondante', () => {
    // PO a un poids mais aucune rune : non brisable, pas un prix manquant.
    const r = breakingValue([{ name: 'PO', value: 1 }], weights, runes, prices)
    expect(r.total).toBe(0)
    expect(r.missingRuneItemIds).toEqual([])
  })

  it('ignore une rune dont lidentifiant nest pas renseigné', () => {
    const unresolved: RuneRef[] = [{ statName: 'Vitalité', runeItemId: 0, runeWeight: 1 }]
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, unresolved, prices)
    expect(r.total).toBe(0)
    expect(r.missingRuneItemIds).toEqual([])
  })

  it('rend le total indéfini quand le prix dune rune utilisée manque', () => {
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, runes, new Map())
    expect(r.total).toBeNull()
    expect(r.missingRuneItemIds).toEqual([900])
  })

  it('détaille le nombre de runes par statistique', () => {
    const r = breakingValue([{ name: 'Vitalité', value: 100 }], weights, runes, prices)
    expect(r.lines).toEqual([
      { statName: 'Vitalité', jet: 100, runeItemId: 900, runeCount: 100, value: 1000 },
    ])
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- breaking`
Attendu : ÉCHEC, `Failed to resolve import "./breaking"`

- [ ] **Step 4: Écrire l'implémentation**

`src/domain/breaking.ts` :

```typescript
import type { RuneRef } from '../catalog/statWeights'
import type { StatRange } from '../catalog/types'
import { unitPrice } from './price'
import type { PriceBook } from './types'

export interface Jet { name: string; value: number }

export interface BreakingLine {
  statName: string
  jet: number
  runeItemId: number
  runeCount: number
  value: number | null
}

export interface BreakingEstimate {
  /** `null` si le prix d'au moins une rune utilisée est inconnu. */
  total: number | null
  lines: BreakingLine[]
  missingRuneItemIds: number[]
}

/** Jets par défaut d'un objet : moyenne des bornes du catalogue. */
export function averageJets(stats: StatRange[]): Jet[] {
  return stats.map((s) => ({ name: s.name, value: (s.min + s.max) / 2 }))
}

/**
 * Valeur estimée du brisage d'un objet.
 *
 * ESTIMATION. Le taux réel dépend de la puissance de brisage et du focus du
 * joueur, non modélisés. Les statistiques sans rune correspondante (PO,
 * Initiative…) ne sont pas brisables et sont ignorées sans être signalées
 * comme manquantes — à la différence d'une rune connue dont le prix n'a pas
 * encore été relevé.
 */
export function breakingValue(
  jets: Jet[],
  statWeights: Record<string, number>,
  runes: RuneRef[],
  prices: PriceBook,
  breakRate = 1,
): BreakingEstimate {
  const runeByStat = new Map(runes.filter((r) => r.runeItemId !== 0).map((r) => [r.statName, r]))
  const lines: BreakingLine[] = []
  const missingRuneItemIds: number[] = []
  let total = 0

  for (const jet of jets) {
    const rune = runeByStat.get(jet.name)
    const weight = statWeights[jet.name]
    if (!rune || weight === undefined || rune.runeWeight === 0) continue

    const runeCount = (jet.value * weight * breakRate) / rune.runeWeight
    const entry = prices.get(rune.runeItemId)
    if (!entry) {
      missingRuneItemIds.push(rune.runeItemId)
      lines.push({ statName: jet.name, jet: jet.value, runeItemId: rune.runeItemId, runeCount, value: null })
      continue
    }
    const value = runeCount * unitPrice(entry)
    total += value
    lines.push({ statName: jet.name, jet: jet.value, runeItemId: rune.runeItemId, runeCount, value })
  }

  return { total: missingRuneItemIds.length > 0 ? null : total, lines, missingRuneItemIds }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- breaking`
Attendu : SUCCÈS, 9 tests

- [ ] **Step 6: Commit**

```bash
git add src/catalog/statWeights.ts src/domain/breaking.ts src/domain/breaking.test.ts
git commit -m "feat: estimation de la valeur de brisage et table de poids des runes"
```

---

## Task 10: Ventes — création, expiration, profit

**Files:**
- Create: `src/domain/sale.ts`
- Test: `src/domain/sale.test.ts`

**Interfaces:**
- Consumes: `LotSize` de `src/domain/types.ts` ; `saleTax` de `src/domain/margin.ts`
- Produces: `SALE_DURATION_MS`, `SaleStatus`, `Sale`, `NewSaleInput`, `createSale`, `isExpired`, `hoursUntilExpiry`, `realizedProfit`, `committedKamas`

- [ ] **Step 1: Écrire le test qui échoue**

`src/domain/sale.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { createSale, isExpired, hoursUntilExpiry, realizedProfit, committedKamas, SALE_DURATION_MS } from './sale'

const NOW = 1_000_000_000_000
const DAY = 86_400_000

const input = { itemId: 1, quantity: 5, lotSize: 1 as const, unitPrice: 10_000, frozenCraftCost: 6000 }

describe('createSale', () => {
  it('fixe lexpiration à 14 jours', () => {
    expect(SALE_DURATION_MS).toBe(14 * DAY)
    const sale = createSale(input, NOW)
    expect(sale.expiresAt).toBe(NOW + 14 * DAY)
  })

  it('démarre au statut en vente', () => {
    expect(createSale(input, NOW).status).toBe('listed')
  })

  it('fige le coût de craft transmis', () => {
    expect(createSale(input, NOW).frozenCraftCost).toBe(6000)
  })
})

describe('isExpired', () => {
  it('est faux avant léchéance', () => {
    expect(isExpired(createSale(input, NOW), NOW + 13 * DAY)).toBe(false)
  })

  it('est vrai à léchéance et après', () => {
    expect(isExpired(createSale(input, NOW), NOW + 14 * DAY)).toBe(true)
    expect(isExpired(createSale(input, NOW), NOW + 20 * DAY)).toBe(true)
  })
})

describe('hoursUntilExpiry', () => {
  it('renvoie les heures restantes', () => {
    expect(hoursUntilExpiry(createSale(input, NOW), NOW + 13 * DAY)).toBe(24)
  })

  it('renvoie zéro plutôt quune valeur négative après expiration', () => {
    expect(hoursUntilExpiry(createSale(input, NOW), NOW + 20 * DAY)).toBe(0)
  })
})

describe('realizedProfit', () => {
  it('déduit la taxe et le coût figé, multipliés par la quantité', () => {
    // (10000 - 200 - 6000) × 5 = 19000
    expect(realizedProfit(createSale(input, NOW))).toBe(19_000)
  })

  it('peut être négatif si le coût dépasse le prix net', () => {
    const bad = createSale({ ...input, unitPrice: 5000 }, NOW)
    expect(realizedProfit(bad)).toBe((5000 - 100 - 6000) * 5)
  })
})

describe('committedKamas', () => {
  it('somme les coûts figés des seules ventes en cours', () => {
    const listed = createSale(input, NOW)
    const sold = { ...createSale(input, NOW), status: 'sold' as const }
    expect(committedKamas([listed, sold])).toBe(6000 * 5)
  })

  it('renvoie zéro sans vente en cours', () => {
    expect(committedKamas([])).toBe(0)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- sale`
Attendu : ÉCHEC, `Failed to resolve import "./sale"`

- [ ] **Step 3: Écrire l'implémentation**

`src/domain/sale.ts` :

```typescript
import { saleTax } from './margin'
import type { LotSize } from './types'
import { HOUR_MS } from './freshness'

/** Durée de mise en vente à l'HDV Dofus Touch. */
export const SALE_DURATION_MS = 14 * 24 * 60 * 60 * 1000

export type SaleStatus = 'listed' | 'sold' | 'returned'

export interface Sale {
  id?: number
  itemId: number
  quantity: number
  lotSize: LotSize
  unitPrice: number
  listedAt: number
  expiresAt: number
  status: SaleStatus
  closedAt?: number
  /** Coût unitaire de production figé à la mise en vente. */
  frozenCraftCost: number
}

export interface NewSaleInput {
  itemId: number
  quantity: number
  lotSize: LotSize
  unitPrice: number
  frozenCraftCost: number
}

export function createSale(input: NewSaleInput, listedAt: number): Sale {
  return { ...input, listedAt, expiresAt: listedAt + SALE_DURATION_MS, status: 'listed' }
}

export function isExpired(sale: Sale, now: number): boolean {
  return now >= sale.expiresAt
}

export function hoursUntilExpiry(sale: Sale, now: number): number {
  return Math.max(0, (sale.expiresAt - now) / HOUR_MS)
}

/**
 * Profit réel d'une vente, calculé sur le coût figé à la mise en vente et non
 * sur les prix courants : recalculer un profit passé avec les prix
 * d'aujourd'hui donnerait un chiffre faux.
 */
export function realizedProfit(sale: Sale): number {
  return (sale.unitPrice - saleTax(sale.unitPrice) - sale.frozenCraftCost) * sale.quantity
}

/** Kamas immobilisés dans les ventes en cours. */
export function committedKamas(sales: Sale[]): number {
  return sales
    .filter((s) => s.status === 'listed')
    .reduce((sum, s) => sum + s.frozenCraftCost * s.quantity, 0)
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- sale`
Attendu : SUCCÈS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/domain/sale.ts src/domain/sale.test.ts
git commit -m "feat: cycle de vie des ventes HDV et profit sur coût figé"
```

---

## Task 11: Couche de stockage

Deux tables de prix plutôt qu'une : `currentPrices` en écrasement (clé = `itemId`) pour un chargement en O(objets), et `priceHistory` en ajout seul pour les tendances futures. Lire tout l'historique pour reconstruire le dernier prix deviendrait lent après quelques mois d'usage.

**Files:**
- Create: `src/store/db.ts`, `src/store/repositories.ts`
- Test: `src/store/repositories.test.ts`

**Interfaces:**
- Consumes: `PriceEntry`, `PriceBook`, `LotSize`, `FreshnessConfig` de `src/domain/types.ts` ; `Sale`, `SaleStatus` de `src/domain/sale.ts` ; `JobLevels` de `src/domain/surveyPriority.ts`
- Produces: `KrosmargeDB`, `db`, `AppSettings`, `DEFAULT_SETTINGS`, `PriceRepository`, `SaleRepository`, `SettingsRepository` avec les implémentations `dexiePrices`, `dexieSales`, `dexieSettings`

- [ ] **Step 1: Écrire le schéma Dexie**

`src/store/db.ts` :

```typescript
import Dexie, { type Table } from 'dexie'
import type { LotSize } from '../domain/types'
import type { Sale } from '../domain/sale'

export interface CurrentPriceRow {
  itemId: number
  kamas: number
  lotSize: LotSize
  observedAt: number
}

export interface PriceHistoryRow extends CurrentPriceRow { id?: number }

export interface SettingRow { key: string; value: unknown }

export class KrosmargeDB extends Dexie {
  currentPrices!: Table<CurrentPriceRow, number>
  priceHistory!: Table<PriceHistoryRow, number>
  sales!: Table<Sale, number>
  settings!: Table<SettingRow, string>

  constructor(name = 'krosmarge') {
    super(name)
    this.version(1).stores({
      currentPrices: 'itemId',
      priceHistory: '++id, itemId, observedAt',
      sales: '++id, itemId, status, expiresAt',
      settings: 'key',
    })
  }
}

export const db = new KrosmargeDB()
```

- [ ] **Step 2: Écrire le test qui échoue**

`src/store/repositories.test.ts` :

```typescript
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { KrosmargeDB } from './db'
import { makePriceRepository, makeSaleRepository, makeSettingsRepository, DEFAULT_SETTINGS } from './repositories'
import { createSale } from '../domain/sale'

let db: KrosmargeDB
let seq = 0

beforeEach(async () => {
  db = new KrosmargeDB(`test-${seq++}`)
  await db.open()
})

describe('PriceRepository', () => {
  it('relit un prix enregistré sous forme de carnet', async () => {
    const repo = makePriceRepository(db)
    await repo.record({ itemId: 5, kamas: 45_000, lotSize: 100, observedAt: 1000 })
    const book = await repo.loadPriceBook()
    expect(book.get(5)).toEqual({ itemId: 5, kamas: 45_000, lotSize: 100, observedAt: 1000 })
  })

  it('écrase le prix courant sans perdre lhistorique', async () => {
    const repo = makePriceRepository(db)
    await repo.record({ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 })
    await repo.record({ itemId: 5, kamas: 200, lotSize: 1, observedAt: 2000 })

    const book = await repo.loadPriceBook()
    expect(book.size).toBe(1)
    expect(book.get(5)?.kamas).toBe(200)
    expect(await repo.historyFor(5)).toHaveLength(2)
  })

  it('renvoie un carnet vide au premier lancement', async () => {
    expect((await makePriceRepository(db).loadPriceBook()).size).toBe(0)
  })
})

describe('SaleRepository', () => {
  it('enregistre et relit les ventes en cours', async () => {
    const repo = makeSaleRepository(db)
    await repo.add(createSale({ itemId: 1, quantity: 2, lotSize: 1, unitPrice: 100, frozenCraftCost: 60 }, 1000))
    expect(await repo.listed()).toHaveLength(1)
  })

  it('sépare les ventes closes des ventes en cours', async () => {
    const repo = makeSaleRepository(db)
    const id = await repo.add(createSale({ itemId: 1, quantity: 2, lotSize: 1, unitPrice: 100, frozenCraftCost: 60 }, 1000))
    await repo.close(id, 'sold', 5000)

    expect(await repo.listed()).toHaveLength(0)
    const all = await repo.all()
    expect(all[0].status).toBe('sold')
    expect(all[0].closedAt).toBe(5000)
  })
})

describe('SettingsRepository', () => {
  it('renvoie les réglages par défaut quand rien nest enregistré', async () => {
    expect(await makeSettingsRepository(db).load()).toEqual(DEFAULT_SETTINGS)
  })

  it('conserve les réglages enregistrés', async () => {
    const repo = makeSettingsRepository(db)
    await repo.save({ ...DEFAULT_SETTINGS, jobLevels: { tailleur: 120 } })
    expect((await repo.load()).jobLevels).toEqual({ tailleur: 120 })
  })

  it('complète un enregistrement partiel avec les valeurs par défaut', async () => {
    const repo = makeSettingsRepository(db)
    await db.settings.put({ key: 'app', value: { jobLevels: { forgeron: 50 } } })
    const loaded = await repo.load()
    expect(loaded.jobLevels).toEqual({ forgeron: 50 })
    expect(loaded.freshness).toEqual(DEFAULT_SETTINGS.freshness)
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- repositories`
Attendu : ÉCHEC, `Failed to resolve import "./repositories"`

- [ ] **Step 4: Écrire l'implémentation**

`src/store/repositories.ts` :

```typescript
import type { KrosmargeDB } from './db'
import type { PriceBook, PriceEntry, FreshnessConfig } from '../domain/types'
import type { Sale, SaleStatus } from '../domain/sale'
import type { JobLevels } from '../domain/surveyPriority'
import { DEFAULT_FRESHNESS } from '../domain/freshness'

export interface AppSettings {
  jobLevels: JobLevels
  freshness: FreshnessConfig
  runeItemIds: Record<string, number>
}

export const DEFAULT_SETTINGS: AppSettings = {
  jobLevels: {},
  freshness: DEFAULT_FRESHNESS,
  runeItemIds: {},
}

const SETTINGS_KEY = 'app'

export interface PriceRepository {
  record(entry: PriceEntry): Promise<void>
  loadPriceBook(): Promise<PriceBook>
  historyFor(itemId: number): Promise<PriceEntry[]>
}

export interface SaleRepository {
  add(sale: Sale): Promise<number>
  listed(): Promise<Sale[]>
  all(): Promise<Sale[]>
  close(id: number, status: SaleStatus, closedAt: number): Promise<void>
}

export interface SettingsRepository {
  load(): Promise<AppSettings>
  save(settings: AppSettings): Promise<void>
}

export function makePriceRepository(db: KrosmargeDB): PriceRepository {
  return {
    async record(entry) {
      await db.transaction('rw', db.currentPrices, db.priceHistory, async () => {
        await db.currentPrices.put(entry)
        await db.priceHistory.add({ ...entry })
      })
    },
    async loadPriceBook() {
      const rows = await db.currentPrices.toArray()
      return new Map(rows.map((row) => [row.itemId, row]))
    },
    async historyFor(itemId) {
      return db.priceHistory.where('itemId').equals(itemId).sortBy('observedAt')
    },
  }
}

export function makeSaleRepository(db: KrosmargeDB): SaleRepository {
  return {
    async add(sale) { return db.sales.add(sale) },
    async listed() { return db.sales.where('status').equals('listed').toArray() },
    async all() { return db.sales.toArray() },
    async close(id, status, closedAt) { await db.sales.update(id, { status, closedAt }) },
  }
}

export function makeSettingsRepository(db: KrosmargeDB): SettingsRepository {
  return {
    async load() {
      const row = await db.settings.get(SETTINGS_KEY)
      // Fusion avec les valeurs par défaut : un enregistrement issu d'une
      // version antérieure peut ne pas porter tous les champs.
      return { ...DEFAULT_SETTINGS, ...((row?.value ?? {}) as Partial<AppSettings>) }
    },
    async save(settings) {
      await db.settings.put({ key: SETTINGS_KEY, value: settings })
    },
  }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- repositories`
Attendu : SUCCÈS, 8 tests

- [ ] **Step 6: Commit**

```bash
git add src/store/
git commit -m "feat: stockage IndexedDB des prix, ventes et réglages"
```

---

## Task 12: Coquille de l'interface et système visuel

**Files:**
- Create: `src/ui/theme.css`, `src/ui/shell/BottomNav.tsx`, `src/ui/components/FreshnessDot.tsx`, `src/ui/components/KamasAmount.tsx`, `src/ui/AppState.tsx`
- Modify: `src/ui/App.tsx`, `src/index.css`
- Test: `src/ui/components/KamasAmount.test.tsx`

**Interfaces:**
- Consumes: `Freshness` de `src/domain/types.ts` ; `loadCatalog` de `src/catalog/loadCatalog.ts` ; dépôts de `src/store/repositories.ts`
- Produces: `TabId`, `BottomNav`, `FreshnessDot`, `KamasAmount`, `formatKamas`, `AppStateProvider`, `useAppState`

- [ ] **Step 1: Établir le système visuel**

Invoquer la skill `ui-ux-pro-max` avec le brief suivant, et en reporter le résultat dans `src/ui/theme.css` sous forme de variables CSS :

> Application mobile-first de gestion économique pour un MMORPG (Dofus Touch). Usage nocturne, souvent d'une seule main, en parallèle du jeu. Doit rester lisible sur petit écran, avec des montants numériques hiérarchisés (la marge est l'information dominante). Palette sombre par défaut. Code couleur sémantique obligatoire pour la fraîcheur des données : frais, acceptable, périmé, manquant — distinguables sans dépendre uniquement de la teinte. Cibles tactiles d'au moins 44 px.

Quelle que soit la direction artistique retenue, `src/ui/theme.css` **doit** définir ces variables — les composants des tâches 12 à 18 les référencent nommément et ne compileront pas visuellement sans elles :

```css
:root {
  /* Fonds et texte */
  --k-bg: ; --k-surface: ; --k-text: ; --k-text-muted: ;
  /* Sémantique des montants */
  --k-positive: ; --k-negative: ; --k-neutral: ;
  /* Fraîcheur — quatre teintes distinctes, doublées par les glyphes de FreshnessDot */
  --k-fresh: ; --k-stale: ; --k-expired: ; --k-missing: ;
  /* Interaction */
  --k-accent: ; --k-accent-text: ; --k-border: ;
  /* Métrique */
  --k-tap-min: 44px; --k-radius: ; --k-gap: ;
}
```

Les sélecteurs attendus par les composants déjà écrits : `.freshness-dot[data-level="fresh|stale|expired|missing"]`, `[data-tone="positive|negative|neutral"]`, `.bottom-nav__tab[aria-selected="true"]`, `.lot-selector__option[aria-pressed="true"]`, `.keypad__key`, `.sale-card[data-urgent="true"]`.

Ne coder aucune couleur en dur dans les composants.

- [ ] **Step 2: Écrire le test qui échoue**

`src/ui/components/KamasAmount.test.tsx` :

```typescript
import { describe, it, expect } from 'vitest'
import { formatKamas } from './KamasAmount'

describe('formatKamas', () => {
  it('sépare les milliers par une espace insécable fine', () => {
    expect(formatKamas(45000)).toBe('45 000 k')
  })

  it('arrondit à lentier', () => {
    expect(formatKamas(4500.7)).toBe('4 501 k')
  })

  it('préfixe explicitement les montants positifs quand demandé', () => {
    expect(formatKamas(1000, { signed: true })).toBe('+1 000 k')
    expect(formatKamas(-1000, { signed: true })).toBe('-1 000 k')
  })

  it('affiche un tiret cadratin pour une valeur inconnue', () => {
    expect(formatKamas(null)).toBe('—')
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- KamasAmount`
Attendu : ÉCHEC, `Failed to resolve import "./KamasAmount"`

- [ ] **Step 4: Écrire les composants**

`src/ui/components/KamasAmount.tsx` :

```tsx
const SEPARATOR = ' '   // espace fine insécable

export function formatKamas(value: number | null, opts: { signed?: boolean } = {}): string {
  if (value === null || Number.isNaN(value)) return '—'
  const rounded = Math.round(value)
  const body = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATOR)
  const sign = rounded < 0 ? '-' : opts.signed ? '+' : ''
  return `${sign}${body}${SEPARATOR}k`
}

export function KamasAmount({ value, signed, className }: {
  value: number | null; signed?: boolean; className?: string
}) {
  const tone = value === null ? 'neutral' : value < 0 ? 'negative' : 'positive'
  return <span className={className} data-tone={tone}>{formatKamas(value, { signed })}</span>
}
```

`src/ui/components/FreshnessDot.tsx` :

```tsx
import type { Freshness } from '../../domain/types'

const LABELS: Record<Freshness, string> = {
  fresh: 'Prix frais', stale: 'Prix acceptable',
  expired: 'Prix périmé', missing: 'Prix manquant',
}

// Le glyphe double le code couleur : la fraîcheur reste lisible sans
// dépendre uniquement de la teinte.
const GLYPHS: Record<Freshness, string> = {
  fresh: '●', stale: '◐', expired: '○', missing: '?',
}

export function FreshnessDot({ level }: { level: Freshness }) {
  return (
    <span className="freshness-dot" data-level={level} title={LABELS[level]} aria-label={LABELS[level]}>
      {GLYPHS[level]}
    </span>
  )
}
```

`src/ui/shell/BottomNav.tsx` :

```tsx
export type TabId = 'crafts' | 'prices' | 'sales' | 'settings'

const TABS: Array<{ id: TabId; label: string; glyph: string }> = [
  { id: 'crafts', label: 'Crafts', glyph: '⚒' },
  { id: 'prices', label: 'Prix', glyph: '⌨' },
  { id: 'sales', label: 'Ventes', glyph: '📦' },
  { id: 'settings', label: 'Réglages', glyph: '⚙' },
]

export function BottomNav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="bottom-nav" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className="bottom-nav__tab"
          onClick={() => onChange(tab.id)}
        >
          <span aria-hidden="true">{tab.glyph}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Écrire le contexte d'application**

`src/ui/AppState.tsx` :

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadCatalog } from '../catalog/loadCatalog'
import type { CatalogIndex } from '../catalog/types'
import { db } from '../store/db'
import { makePriceRepository, makeSaleRepository, makeSettingsRepository, DEFAULT_SETTINGS, type AppSettings } from '../store/repositories'
import type { PriceBook } from '../domain/types'
import type { Sale } from '../domain/sale'

const prices = makePriceRepository(db)
const sales = makeSaleRepository(db)
const settingsRepo = makeSettingsRepository(db)

interface AppStateValue {
  catalog: CatalogIndex | null
  priceBook: PriceBook
  settings: AppSettings
  saleList: Sale[]
  error: string | null
  recordPrice(itemId: number, kamas: number, lotSize: 1 | 10 | 100): Promise<void>
  saveSettings(next: AppSettings): Promise<void>
  addSale(sale: Sale): Promise<void>
  refreshSales(): Promise<void>
}

const Ctx = createContext<AppStateValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null)
  const [priceBook, setPriceBook] = useState<PriceBook>(new Map())
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saleList, setSaleList] = useState<Sale[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setCatalog(await loadCatalog())
        setPriceBook(await prices.loadPriceBook())
        setSettings(await settingsRepo.load())
        setSaleList(await sales.all())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chargement impossible')
      }
    })()
  }, [])

  const value: AppStateValue = {
    catalog, priceBook, settings, saleList, error,
    async recordPrice(itemId, kamas, lotSize) {
      await prices.record({ itemId, kamas, lotSize, observedAt: Date.now() })
      setPriceBook(await prices.loadPriceBook())
    },
    async saveSettings(next) {
      await settingsRepo.save(next)
      setSettings(next)
    },
    async addSale(sale) {
      await sales.add(sale)
      setSaleList(await sales.all())
    },
    async refreshSales() { setSaleList(await sales.all()) },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState(): AppStateValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppState doit être utilisé dans AppStateProvider')
  return ctx
}
```

`Date.now()` est appelé ici, dans la couche interface — jamais dans `domain/`.

- [ ] **Step 6: Câbler App.tsx**

`src/ui/App.tsx` :

```tsx
import { useState } from 'react'
import { BottomNav, type TabId } from './shell/BottomNav'
import { AppStateProvider, useAppState } from './AppState'

function Shell() {
  const [tab, setTab] = useState<TabId>('crafts')
  const { catalog, error } = useAppState()

  if (error) return <p className="app-error">{error}</p>
  if (!catalog) return <p className="app-loading">Chargement du catalogue…</p>

  return (
    <div className="app">
      <main className="app__main">
        {tab === 'crafts' && <p>Crafts</p>}
        {tab === 'prices' && <p>Prix</p>}
        {tab === 'sales' && <p>Ventes</p>}
        {tab === 'settings' && <p>Réglages</p>}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default function App() {
  return <AppStateProvider><Shell /></AppStateProvider>
}
```

Les quatre `<p>` sont remplacés par les vrais écrans aux tâches 13 à 17.

`src/index.css` :

```css
@import "tailwindcss";
@import "./ui/theme.css";
```

- [ ] **Step 7: Lancer les tests et vérifier l'application**

Lancer : `npm test`
Attendu : SUCCÈS, tous les tests

Lancer : `npm run build:catalog && npm run dev`
Attendu : les quatre onglets basculent, aucune erreur en console.

- [ ] **Step 8: Commit**

```bash
git add src/ui/ src/index.css
git commit -m "feat: coquille de navigation, système visuel et état applicatif"
```

---

## Task 13: Écran Crafts

**Files:**
- Create: `src/domain/craftRanking.ts`, `src/ui/screens/CraftsScreen.tsx`
- Test: `src/domain/craftRanking.test.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `craftCost`, `craftMargin`, `freshnessOf`, `worstFreshness`, `canCraft`, `JobLevels`, `CatalogIndex`, `PriceBook`
- Produces: `RankedCraft`, `rankCrafts(index, prices, jobLevels, now, cfg?): { ranked: RankedCraft[]; incomplete: RankedCraft[] }` ; `CraftsScreen`

- [ ] **Step 1: Écrire le test qui échoue**

`src/domain/craftRanking.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { rankCrafts } from './craftRanking'
import { buildCatalogIndex } from '../catalog/loadCatalog'
import { HOUR_MS } from './freshness'
import type { Catalog } from '../catalog/types'
import type { PriceBook } from './types'

const NOW = 1_000_000_000_000

const catalog: Catalog = {
  version: 't',
  items: [
    { id: 1, name: 'Chapeau', type: 'Chapeau', level: 10, imgUrl: '', stats: [] },
    { id: 2, name: 'Cuir', type: 'Peau', level: 1, imgUrl: '', stats: [] },
    { id: 4, name: 'Cape', type: 'Cape', level: 10, imgUrl: '', stats: [] },
    { id: 5, name: 'Soie', type: 'Étoffe', level: 1, imgUrl: '', stats: [] },
  ],
  recipes: [
    { resultItemId: 1, job: 'tailleur', ingredients: [{ itemId: 2, quantity: 10 }] },
    { resultItemId: 4, job: 'tailleur', ingredients: [{ itemId: 5, quantity: 10 }] },
  ],
}
const index = buildCatalogIndex(catalog)

const at = (itemId: number, kamas: number, ageHours = 0) =>
  [itemId, { itemId, kamas, lotSize: 1 as const, observedAt: NOW - ageHours * HOUR_MS }] as const

describe('rankCrafts', () => {
  it('classe par marge nette décroissante', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000), at(5, 100), at(4, 2000)])
    const { ranked } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    expect(ranked.map((r) => r.resultItemId)).toEqual([1, 4])
  })

  it('calcule la marge en déduisant la taxe de 2 pourcent', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000)])
    const { ranked } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    // coût 1000, vente 5000, taxe 100 → 3900
    expect(ranked[0].margin?.net).toBe(3900)
  })

  it('sépare les crafts incalculables au lieu de les classer', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000)])
    const { ranked, incomplete } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    expect(ranked.map((r) => r.resultItemId)).toEqual([1])
    expect(incomplete.map((r) => r.resultItemId)).toEqual([4])
    expect(incomplete[0].margin).toBeNull()
  })

  it('signale les objets dont le prix manque', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000)])
    const { incomplete } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    expect(incomplete[0].missingItemIds).toEqual([5, 4])
  })

  it('propage la fraîcheur la plus dégradée au craft', () => {
    const prices: PriceBook = new Map([at(2, 100, 100), at(1, 5000, 1)])
    const { ranked } = rankCrafts(index, prices, { tailleur: 50 }, NOW)
    expect(ranked[0].confidence).toBe('expired')
  })

  it('exclut les recettes hors niveau de métier', () => {
    const prices: PriceBook = new Map([at(2, 100), at(1, 5000), at(5, 100), at(4, 2000)])
    const { ranked, incomplete } = rankCrafts(index, prices, { tailleur: 9 }, NOW)
    expect(ranked).toHaveLength(0)
    expect(incomplete).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- craftRanking`
Attendu : ÉCHEC, `Failed to resolve import "./craftRanking"`

- [ ] **Step 3: Écrire l'implémentation du domaine**

`src/domain/craftRanking.ts` :

```typescript
import type { CatalogIndex, Job } from '../catalog/types'
import { craftCost, type CostLine } from './craftCost'
import { DEFAULT_FRESHNESS, freshnessOf, worstFreshness } from './freshness'
import { craftMargin, type CraftMargin } from './margin'
import { unitPrice } from './price'
import { canCraft, type JobLevels } from './surveyPriority'
import type { Freshness, FreshnessConfig, PriceBook } from './types'

export interface RankedCraft {
  resultItemId: number
  job: Job
  cost: number | null
  salePrice: number | null
  margin: CraftMargin | null
  confidence: Freshness
  lines: CostLine[]
  missingItemIds: number[]
}

/**
 * Sépare les crafts calculables des autres. Un craft dont un prix manque n'est
 * jamais classé avec une valeur estimée : il part dans `incomplete`, où
 * l'interface propose de compléter les relevés.
 */
export function rankCrafts(
  index: CatalogIndex,
  prices: PriceBook,
  jobLevels: JobLevels,
  now: number,
  cfg: FreshnessConfig = DEFAULT_FRESHNESS,
): { ranked: RankedCraft[]; incomplete: RankedCraft[] } {
  const ranked: RankedCraft[] = []
  const incomplete: RankedCraft[] = []

  for (const recipe of index.recipeByResultId.values()) {
    if (!canCraft(recipe, index, jobLevels)) continue

    const cost = craftCost(recipe, prices)
    const saleEntry = prices.get(recipe.resultItemId)
    const salePrice = saleEntry ? unitPrice(saleEntry) : null

    const missingItemIds = [...cost.missingItemIds]
    if (!saleEntry) missingItemIds.push(recipe.resultItemId)

    const confidence = worstFreshness([
      ...recipe.ingredients.map((i) => freshnessOf(prices.get(i.itemId), now, cfg)),
      freshnessOf(saleEntry, now, cfg),
    ])

    const entry: RankedCraft = {
      resultItemId: recipe.resultItemId,
      job: recipe.job,
      cost: cost.total,
      salePrice,
      margin: cost.total !== null && salePrice !== null ? craftMargin(cost.total, salePrice) : null,
      confidence,
      lines: cost.lines,
      missingItemIds,
    }

    if (entry.margin) ranked.push(entry)
    else incomplete.push(entry)
  }

  ranked.sort((a, b) => b.margin!.net - a.margin!.net)
  return { ranked, incomplete }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- craftRanking`
Attendu : SUCCÈS, 6 tests

- [ ] **Step 5: Écrire l'écran**

`src/ui/screens/CraftsScreen.tsx` :

```tsx
import { useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { rankCrafts, type RankedCraft } from '../../domain/craftRanking'
import { JOB_LABELS, type Job } from '../../catalog/types'
import { FreshnessDot } from '../components/FreshnessDot'
import { KamasAmount } from '../components/KamasAmount'

type SortKey = 'net' | 'pct'

export function CraftsScreen({ onOpen, onSurvey }: {
  onOpen: (itemId: number) => void
  onSurvey: () => void
}) {
  const { catalog, priceBook, settings } = useAppState()
  const [jobFilter, setJobFilter] = useState<Job | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('net')

  const { ranked, incomplete } = useMemo(
    () => rankCrafts(catalog!, priceBook, settings.jobLevels, Date.now(), settings.freshness),
    [catalog, priceBook, settings],
  )

  const visible = useMemo(() => {
    const list = jobFilter === 'all' ? ranked : ranked.filter((r) => r.job === jobFilter)
    return sort === 'net'
      ? list
      : [...list].sort((a, b) => b.margin!.pct - a.margin!.pct)
  }, [ranked, jobFilter, sort])

  const declaredJobs = Object.keys(settings.jobLevels) as Job[]

  return (
    <section className="crafts">
      <header className="crafts__header">
        <div className="crafts__filters" role="group" aria-label="Filtrer par métier">
          <button aria-pressed={jobFilter === 'all'} onClick={() => setJobFilter('all')}>Tous</button>
          {declaredJobs.map((job) => (
            <button key={job} aria-pressed={jobFilter === job} onClick={() => setJobFilter(job)}>
              {JOB_LABELS[job]}
            </button>
          ))}
        </div>
        <div className="crafts__sort" role="group" aria-label="Trier">
          <button aria-pressed={sort === 'net'} onClick={() => setSort('net')}>Marge</button>
          <button aria-pressed={sort === 'pct'} onClick={() => setSort('pct')}>%</button>
        </div>
      </header>

      {incomplete.length > 0 && (
        <button className="crafts__banner" onClick={onSurvey}>
          {incomplete.length} craft{incomplete.length > 1 ? 's' : ''} non classé
          {incomplete.length > 1 ? 's' : ''}, il manque des prix — Relever
        </button>
      )}

      {declaredJobs.length === 0 && (
        <p className="crafts__empty">
          Déclare tes niveaux de métier dans les réglages pour voir tes crafts.
        </p>
      )}

      <ul className="crafts__list">
        {visible.map((craft) => (
          <CraftRow key={craft.resultItemId} craft={craft} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  )
}

function CraftRow({ craft, onOpen }: { craft: RankedCraft; onOpen: (id: number) => void }) {
  const { catalog } = useAppState()
  const item = catalog!.itemsById.get(craft.resultItemId)
  if (!item) return null

  return (
    <li>
      <button className="craft-row" onClick={() => onOpen(craft.resultItemId)}>
        <img src={item.imgUrl} alt="" width={40} height={40} loading="lazy" />
        <span className="craft-row__name">
          {item.name}
          <span className="craft-row__level">Niv. {item.level}</span>
        </span>
        <span className="craft-row__margin">
          <KamasAmount value={craft.margin!.net} signed />
          <span className="craft-row__pct">{(craft.margin!.pct * 100).toFixed(0)} %</span>
        </span>
        <FreshnessDot level={craft.confidence} />
      </button>
    </li>
  )
}
```

- [ ] **Step 6: Brancher l'écran dans App.tsx**

Dans `src/ui/App.tsx`, remplacer `{tab === 'crafts' && <p>Crafts</p>}` par :

```tsx
{tab === 'crafts' && <CraftsScreen onOpen={setDetailItemId} onSurvey={() => setTab('prices')} />}
```

et ajouter dans `Shell` :

```tsx
const [detailItemId, setDetailItemId] = useState<number | null>(null)
```

L'import : `import { CraftsScreen } from './screens/CraftsScreen'`

- [ ] **Step 7: Vérifier**

Lancer : `npm test`
Attendu : SUCCÈS, tous les tests

Lancer : `npm run dev`
Attendu : après déclaration d'un niveau de métier en base, la liste s'affiche ; sans prix, le bandeau des crafts non classés apparaît.

- [ ] **Step 8: Commit**

```bash
git add src/domain/craftRanking.ts src/domain/craftRanking.test.ts src/ui/
git commit -m "feat: classement des crafts par marge nette avec crafts incomplets isolés"
```

---

## Task 14: Détail d'un craft et carte de brisage

**Files:**
- Create: `src/ui/screens/CraftDetailScreen.tsx`, `src/ui/components/LotSelector.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `rankCrafts` ou `craftCost` + `craftMargin` ; `breakingValue`, `averageJets` ; `createSale` ; `STAT_WEIGHTS`, `RUNES`
- Produces: `CraftDetailScreen`, `LotSelector`

- [ ] **Step 1: Écrire le sélecteur de lot**

`src/ui/components/LotSelector.tsx` :

```tsx
import type { LotSize } from '../../domain/types'

const LOTS: LotSize[] = [1, 10, 100]

export function LotSelector({ value, onChange }: {
  value: LotSize; onChange: (lot: LotSize) => void
}) {
  return (
    <div className="lot-selector" role="group" aria-label="Taille du lot">
      {LOTS.map((lot) => (
        <button
          key={lot}
          type="button"
          aria-pressed={value === lot}
          className="lot-selector__option"
          onClick={() => onChange(lot)}
        >
          ×{lot}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Écrire l'écran de détail**

`src/ui/screens/CraftDetailScreen.tsx` :

```tsx
import { useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { craftCost } from '../../domain/craftCost'
import { craftMargin } from '../../domain/margin'
import { unitPrice } from '../../domain/price'
import { freshnessOf } from '../../domain/freshness'
import { averageJets, breakingValue } from '../../domain/breaking'
import { createSale } from '../../domain/sale'
import { RUNES, STAT_WEIGHTS } from '../../catalog/statWeights'
import { KamasAmount, formatKamas } from '../components/KamasAmount'
import { FreshnessDot } from '../components/FreshnessDot'
import { LotSelector } from '../components/LotSelector'
import type { LotSize } from '../../domain/types'

export function CraftDetailScreen({ itemId, onClose, onEditPrice }: {
  itemId: number
  onClose: () => void
  onEditPrice: (itemId: number) => void
}) {
  const { catalog, priceBook, settings, addSale } = useAppState()
  const item = catalog!.itemsById.get(itemId)
  const recipe = catalog!.recipeByResultId.get(itemId)

  const [simulated, setSimulated] = useState<number | null>(null)
  const [saleLot, setSaleLot] = useState<LotSize>(1)
  const [saleQty, setSaleQty] = useState(1)

  const now = Date.now()
  const cost = useMemo(() => (recipe ? craftCost(recipe, priceBook) : null), [recipe, priceBook])
  const recordedSale = priceBook.get(itemId)
  const effectiveSalePrice = simulated ?? (recordedSale ? unitPrice(recordedSale) : null)

  const totalCost = cost?.total ?? null
  const margin = totalCost !== null && effectiveSalePrice !== null
    ? craftMargin(totalCost, effectiveSalePrice)
    : null

  const breaking = useMemo(
    () => (item ? breakingValue(averageJets(item.stats), STAT_WEIGHTS, resolveRunes(settings.runeItemIds), priceBook) : null),
    [item, priceBook, settings.runeItemIds],
  )

  if (!item || !recipe || !cost) return <p>Objet introuvable.</p>

  return (
    <section className="detail">
      <header className="detail__header">
        <button onClick={onClose} aria-label="Fermer">←</button>
        <img src={item.imgUrl} alt="" width={48} height={48} />
        <h1>{item.name}</h1>
      </header>

      <ul className="detail__ingredients">
        {cost.lines.map((line) => {
          const ing = catalog!.itemsById.get(line.itemId)
          return (
            <li key={line.itemId}>
              <button className="detail__line" onClick={() => onEditPrice(line.itemId)}>
                <img src={ing?.imgUrl} alt="" width={28} height={28} loading="lazy" />
                <span>{ing?.name ?? `Objet ${line.itemId}`}</span>
                <span>{line.quantity} × {formatKamas(line.unitPrice)}</span>
                <KamasAmount value={line.subtotal} />
                <FreshnessDot level={freshnessOf(priceBook.get(line.itemId), now, settings.freshness)} />
              </button>
            </li>
          )
        })}
      </ul>

      <dl className="detail__totals">
        <dt>Coût de craft</dt><dd><KamasAmount value={cost.total} /></dd>
        <dt>Prix de vente</dt>
        <dd>
          <input
            type="number"
            inputMode="numeric"
            value={effectiveSalePrice ?? ''}
            placeholder="à relever"
            onChange={(e) => setSimulated(e.target.value === '' ? null : Number(e.target.value))}
          />
          {simulated !== null && <span className="detail__simulated">simulation, non enregistrée</span>}
        </dd>
        <dt>Taxe 2 %</dt><dd><KamasAmount value={margin?.tax ?? null} /></dd>
        <dt>Marge nette</dt>
        <dd><KamasAmount value={margin?.net ?? null} signed />
          {margin && <span> ({(margin.pct * 100).toFixed(0)} %)</span>}
        </dd>
      </dl>

      <section className="detail__breaking">
        <h2>Vendre ou briser</h2>
        <p>
          Vendre <KamasAmount value={effectiveSalePrice} /> ·
          Briser ≈ <KamasAmount value={breaking?.total ?? null} />
        </p>
        <p className="detail__estimate">
          Estimation. Le taux réel dépend de ta puissance de brisage et du focus.
        </p>
      </section>

      <section className="detail__list-sale">
        <h2>J'ai crafté et mis en vente</h2>
        <LotSelector value={saleLot} onChange={setSaleLot} />
        <input
          type="number" inputMode="numeric" min={1} value={saleQty}
          onChange={(e) => setSaleQty(Math.max(1, Number(e.target.value)))}
          aria-label="Quantité"
        />
        <button
          disabled={cost.total === null || effectiveSalePrice === null}
          onClick={() => {
            void addSale(createSale({
              itemId, quantity: saleQty, lotSize: saleLot,
              unitPrice: effectiveSalePrice!, frozenCraftCost: cost.total!,
            }, Date.now()))
          }}
        >
          Enregistrer la vente
        </button>
      </section>
    </section>
  )
}

/** Applique les identifiants de runes renseignés dans les réglages. */
function resolveRunes(runeItemIds: Record<string, number>) {
  return RUNES.map((r) => ({ ...r, runeItemId: runeItemIds[r.statName] ?? r.runeItemId }))
}
```

- [ ] **Step 3: Brancher dans App.tsx**

Dans `Shell`, avant le rendu des onglets :

```tsx
if (detailItemId !== null) {
  return (
    <CraftDetailScreen
      itemId={detailItemId}
      onClose={() => setDetailItemId(null)}
      onEditPrice={(id) => { setDetailItemId(null); setTab('prices'); setPriceTarget(id) }}
    />
  )
}
```

et ajouter l'état `const [priceTarget, setPriceTarget] = useState<number | null>(null)`, consommé à la tâche 15.

- [ ] **Step 4: Vérifier**

Lancer : `npm test`
Attendu : SUCCÈS, tous les tests

Lancer : `npm run dev`
Attendu : ouvrir un craft affiche le détail, la simulation modifie la marge sans être enregistrée, l'enregistrement de vente fonctionne.

- [ ] **Step 5: Commit**

```bash
git add src/ui/
git commit -m "feat: écran de détail dun craft avec simulation et comparaison de brisage"
```

---

## Task 15: Relevé de prix — mode guidé et recherche libre

**Files:**
- Create: `src/ui/components/NumericKeypad.tsx`, `src/ui/screens/PricesScreen.tsx`
- Test: `src/ui/components/NumericKeypad.test.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `surveyPriority` ; `recordPrice` de `useAppState` ; `LotSelector`
- Produces: `NumericKeypad`, `applyKey`, `PricesScreen`

- [ ] **Step 1: Écrire le test qui échoue**

`src/ui/components/NumericKeypad.test.tsx` :

```typescript
import { describe, it, expect } from 'vitest'
import { applyKey } from './NumericKeypad'

describe('applyKey', () => {
  it('concatène les chiffres', () => {
    expect(applyKey('45', '0')).toBe('450')
  })

  it('supprime le dernier caractère', () => {
    expect(applyKey('450', 'back')).toBe('45')
    expect(applyKey('', 'back')).toBe('')
  })

  it('vide la saisie', () => {
    expect(applyKey('450', 'clear')).toBe('')
  })

  it('ajoute trois zéros dun coup', () => {
    expect(applyKey('45', '000')).toBe('45000')
  })

  it('ignore un zéro initial isolé', () => {
    expect(applyKey('', '0')).toBe('')
    expect(applyKey('', '000')).toBe('')
  })

  it('borne la saisie à neuf chiffres', () => {
    expect(applyKey('123456789', '1')).toBe('123456789')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- NumericKeypad`
Attendu : ÉCHEC, `Failed to resolve import "./NumericKeypad"`

- [ ] **Step 3: Écrire le pavé numérique**

`src/ui/components/NumericKeypad.tsx` :

```tsx
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'back' | 'clear'

const MAX_DIGITS = 9

/** Applique une touche à la saisie courante. Fonction pure, testée isolément. */
export function applyKey(current: string, key: KeypadKey): string {
  if (key === 'clear') return ''
  if (key === 'back') return current.slice(0, -1)
  if (current === '' && (key === '0' || key === '000')) return ''
  const next = current + key
  return next.length > MAX_DIGITS ? current : next
}

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back']

const LABELS: Partial<Record<KeypadKey, string>> = { back: '⌫' }

export function NumericKeypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  return (
    <div className="keypad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="keypad__key"
          onClick={() => onKey(key)}
          aria-label={key === 'back' ? 'Effacer' : key}
        >
          {LABELS[key] ?? key}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- NumericKeypad`
Attendu : SUCCÈS, 6 tests

- [ ] **Step 5: Écrire l'écran de relevé**

`src/ui/screens/PricesScreen.tsx` :

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { surveyPriority } from '../../domain/surveyPriority'
import { freshnessOf, HOUR_MS } from '../../domain/freshness'
import { unitPrice } from '../../domain/price'
import { NumericKeypad, applyKey } from '../components/NumericKeypad'
import { LotSelector } from '../components/LotSelector'
import { FreshnessDot } from '../components/FreshnessDot'
import { formatKamas } from '../components/KamasAmount'
import type { LotSize } from '../../domain/types'

const QUEUE_LENGTH = 12

export function PricesScreen({ target, onTargetHandled }: {
  target: number | null
  onTargetHandled: () => void
}) {
  const { catalog, priceBook, settings, recordPrice } = useAppState()
  const [mode, setMode] = useState<'guided' | 'search'>('guided')
  const [cursor, setCursor] = useState(0)
  const [draft, setDraft] = useState('')
  const [lot, setLot] = useState<LotSize>(1)
  const [recorded, setRecorded] = useState(0)
  const [search, setSearch] = useState('')
  const [manualId, setManualId] = useState<number | null>(null)

  // Photographie des crafts déjà rentables à l'ouverture de la session, pour
  // pouvoir dire au joueur ce que son relevé a débloqué (spec §7.3).
  const [profitableAtStart] = useState(
    () => new Set(
      rankCrafts(catalog!, priceBook, settings.jobLevels, Date.now(), settings.freshness)
        .ranked.filter((c) => c.margin!.net > 0)
        .map((c) => c.resultItemId),
    ),
  )

  const queue = useMemo(
    () => surveyPriority(catalog!, priceBook, settings.jobLevels, Date.now(), settings.freshness)
      .slice(0, QUEUE_LENGTH)
      .map((e) => e.itemId),
    // La file est figée à l'ouverture : la recalculer après chaque saisie
    // réordonnerait la liste sous les doigts du joueur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, settings],
  )

  useEffect(() => {
    if (target !== null) { setMode('search'); setManualId(target); onTargetHandled() }
  }, [target, onTargetHandled])

  const currentId = manualId ?? queue[cursor] ?? null
  const item = currentId === null ? null : catalog!.itemsById.get(currentId)
  const existing = currentId === null ? undefined : priceBook.get(currentId)

  const submit = async () => {
    if (!currentId || draft === '') return
    await recordPrice(currentId, Number(draft), lot)
    setRecorded((n) => n + 1)
    setDraft('')
    if (manualId !== null) setManualId(null)
    else setCursor((c) => c + 1)
  }

  if (mode === 'guided' && cursor >= queue.length && manualId === null) {
    return (
      <SurveyRecap
        recorded={recorded}
        profitableAtStart={profitableAtStart}
        onRestart={() => { setCursor(0); setRecorded(0) }}
        onSearch={() => setMode('search')}
      />
    )
  }

  return (
    <section className="survey">
      <header className="survey__header">
        <button aria-pressed={mode === 'guided'} onClick={() => { setMode('guided'); setManualId(null) }}>Guidé</button>
        <button aria-pressed={mode === 'search'} onClick={() => setMode('search')}>Recherche</button>
        {mode === 'guided' && <span className="survey__progress">{cursor + 1} / {queue.length}</span>}
      </header>

      {mode === 'search' && (
        <div className="survey__search">
          <input
            type="search" value={search} placeholder="Nom de l'objet"
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul>
            {search.length >= 3 && [...catalog!.itemsById.values()]
              .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
              .slice(0, 20)
              .map((i) => (
                <li key={i.id}>
                  <button onClick={() => { setManualId(i.id); setSearch('') }}>
                    <img src={i.imgUrl} alt="" width={24} height={24} loading="lazy" /> {i.name}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {item && (
        <>
          <div className="survey__item">
            <img src={item.imgUrl} alt="" width={64} height={64} />
            <h1>{item.name}</h1>
            <p className="survey__previous">
              <FreshnessDot level={freshnessOf(existing, Date.now(), settings.freshness)} />
              {existing
                ? `${formatKamas(unitPrice(existing))} l'unité · ${describeAge(Date.now() - existing.observedAt)}`
                : 'Jamais relevé'}
            </p>
          </div>

          <LotSelector value={lot} onChange={setLot} />

          <output className="survey__draft">{draft === '' ? '—' : formatKamas(Number(draft))}</output>

          <NumericKeypad onKey={(key) => setDraft((d) => applyKey(d, key))} />

          <div className="survey__actions">
            <button onClick={() => { setDraft(''); setCursor((c) => c + 1) }}>Passer</button>
            <button disabled={draft === ''} onClick={() => void submit()}>Valider</button>
          </div>
        </>
      )}
    </section>
  )
}

function describeAge(ms: number): string {
  const hours = ms / HOUR_MS
  if (hours < 1) return "il y a moins d'une heure"
  if (hours < 24) return `il y a ${Math.floor(hours)} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

/**
 * Écran de fin de session. Il ne se contente pas de compter les saisies : il
 * relie l'effort au gain en nommant les crafts devenus rentables. C'est ce qui
 * donne au joueur une raison de recommencer.
 */
function SurveyRecap({ recorded, profitableAtStart, onRestart, onSearch }: {
  recorded: number
  profitableAtStart: Set<number>
  onRestart: () => void
  onSearch: () => void
}) {
  const { catalog, priceBook, settings } = useAppState()
  const { ranked } = rankCrafts(catalog!, priceBook, settings.jobLevels, Date.now(), settings.freshness)
  const profitable = ranked.filter((c) => c.margin!.net > 0)
  const unlocked = profitable.filter((c) => !profitableAtStart.has(c.resultItemId))

  return (
    <section className="survey-done">
      <h1>{recorded} prix relevé{recorded > 1 ? 's' : ''}</h1>
      <p>{ranked.length} craft{ranked.length > 1 ? 's' : ''} calculable{ranked.length > 1 ? 's' : ''}.</p>

      {unlocked.length > 0 ? (
        <>
          <h2>
            {unlocked.length} craft{unlocked.length > 1 ? 's sont devenus rentables' : ' est devenu rentable'}
          </h2>
          <ul className="survey-done__unlocked">
            {unlocked.slice(0, 5).map((craft) => (
              <li key={craft.resultItemId}>
                {catalog!.itemsById.get(craft.resultItemId)?.name ?? craft.resultItemId}
                {' '}<KamasAmount value={craft.margin!.net} signed />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Aucun nouveau craft rentable cette fois.</p>
      )}

      <button onClick={onRestart}>Nouvelle session</button>
      <button onClick={onSearch}>Recherche libre</button>
    </section>
  )
}
```

Ajouter aux imports de ce fichier : `import { rankCrafts } from '../../domain/craftRanking'` et `import { KamasAmount, formatKamas } from '../components/KamasAmount'` (l'import de `formatKamas` seul ne suffit plus).

- [ ] **Step 6: Brancher dans App.tsx**

Remplacer `{tab === 'prices' && <p>Prix</p>}` par :

```tsx
{tab === 'prices' && (
  <PricesScreen target={priceTarget} onTargetHandled={() => setPriceTarget(null)} />
)}
```

- [ ] **Step 7: Vérifier**

Lancer : `npm test`
Attendu : SUCCÈS, tous les tests

Lancer : `npm run dev`
Attendu : la file guidée propose des objets, le pavé numérique fonctionne, la validation enchaîne sur le suivant, la recherche libre trouve un objet par son nom.

- [ ] **Step 8: Commit**

```bash
git add src/ui/
git commit -m "feat: relevé de prix guidé avec pavé numérique et recherche libre"
```

---

## Task 16: Écran Ventes

**Files:**
- Create: `src/ui/screens/SalesScreen.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/AppState.tsx` (ajout de `closeSale`)

**Interfaces:**
- Consumes: `hoursUntilExpiry`, `realizedProfit`, `committedKamas`, `isExpired` de `src/domain/sale.ts`
- Produces: `SalesScreen`

- [ ] **Step 1: Ajouter la clôture d'une vente à l'état**

Dans `src/ui/AppState.tsx`, ajouter à l'interface `AppStateValue` :

```typescript
closeSale(id: number, status: 'sold' | 'returned'): Promise<void>
```

et à l'objet `value` :

```typescript
async closeSale(id, status) {
  await sales.close(id, status, Date.now())
  setSaleList(await sales.all())
},
```

- [ ] **Step 2: Écrire l'écran**

`src/ui/screens/SalesScreen.tsx` :

```tsx
import { useAppState } from '../AppState'
import { committedKamas, hoursUntilExpiry, realizedProfit } from '../../domain/sale'
import { KamasAmount } from '../components/KamasAmount'

const ALERT_HOURS = 48

export function SalesScreen() {
  const { catalog, saleList, closeSale } = useAppState()
  const now = Date.now()

  const listed = saleList.filter((s) => s.status === 'listed')
  const closed = saleList.filter((s) => s.status !== 'listed')
  const realized = closed
    .filter((s) => s.status === 'sold')
    .reduce((sum, s) => sum + realizedProfit(s), 0)

  return (
    <section className="sales">
      <dl className="sales__summary">
        <dt>Engagé en HDV</dt><dd><KamasAmount value={committedKamas(saleList)} /></dd>
        <dt>Profit réalisé</dt><dd><KamasAmount value={realized} signed /></dd>
      </dl>

      <h2>En vente</h2>
      {listed.length === 0 && <p>Aucune vente en cours.</p>}
      <ul className="sales__list">
        {listed.map((sale) => {
          const remaining = hoursUntilExpiry(sale, now)
          const item = catalog!.itemsById.get(sale.itemId)
          return (
            <li key={sale.id} className="sale-card" data-urgent={remaining < ALERT_HOURS}>
              <img src={item?.imgUrl} alt="" width={36} height={36} loading="lazy" />
              <span>{item?.name ?? `Objet ${sale.itemId}`}</span>
              <span>×{sale.quantity}</span>
              <KamasAmount value={sale.unitPrice} />
              <span className="sale-card__expiry">
                {remaining === 0
                  ? 'Expirée'
                  : remaining < ALERT_HOURS
                    ? `Expire dans ${Math.floor(remaining)} h`
                    : `${Math.floor(remaining / 24)} j restants`}
              </span>
              <button onClick={() => void closeSale(sale.id!, 'sold')}>Vendu</button>
              <button onClick={() => void closeSale(sale.id!, 'returned')}>Retourné</button>
            </li>
          )
        })}
      </ul>

      <h2>Historique</h2>
      <ul className="sales__history">
        {closed.map((sale) => (
          <li key={sale.id}>
            {catalog!.itemsById.get(sale.itemId)?.name ?? sale.itemId} ×{sale.quantity} —{' '}
            {sale.status === 'sold'
              ? <KamasAmount value={realizedProfit(sale)} signed />
              : 'retourné en banque'}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

Une vente retournée n'est pas neutre : la taxe de 2 % a été payée à la mise en vente et n'est pas remboursée. Le profit réalisé ne compte que les ventes conclues, conformément à la spec.

- [ ] **Step 3: Brancher dans App.tsx**

Remplacer `{tab === 'sales' && <p>Ventes</p>}` par `{tab === 'sales' && <SalesScreen />}`.

- [ ] **Step 4: Vérifier**

Lancer : `npm test`
Attendu : SUCCÈS, tous les tests

Lancer : `npm run dev`
Attendu : une vente créée depuis le détail d'un craft apparaît, le compte à rebours s'affiche, « Vendu » la bascule dans l'historique avec son profit.

- [ ] **Step 5: Commit**

```bash
git add src/ui/
git commit -m "feat: suivi des ventes HDV avec alerte dexpiration et profit réalisé"
```

---

## Task 17: Réglages, export et import

**Files:**
- Create: `src/store/backup.ts`, `src/ui/screens/SettingsScreen.tsx`
- Test: `src/store/backup.test.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `KrosmargeDB`, `AppSettings` ; `Job`, `JOB_LABELS` ; `RUNES`
- Produces: `BackupPayload`, `exportBackup(db): Promise<BackupPayload>`, `importBackup(db, payload): Promise<void>`, `SettingsScreen`

- [ ] **Step 1: Écrire le test qui échoue**

`src/store/backup.test.ts` :

```typescript
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { KrosmargeDB } from './db'
import { exportBackup, importBackup, BACKUP_VERSION } from './backup'
import { makePriceRepository, makeSettingsRepository, DEFAULT_SETTINGS } from './repositories'

let db: KrosmargeDB
let seq = 0

beforeEach(async () => {
  db = new KrosmargeDB(`backup-${seq++}`)
  await db.open()
})

describe('exportBackup', () => {
  it('exporte prix, ventes et réglages avec un numéro de version', async () => {
    await makePriceRepository(db).record({ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 })
    const payload = await exportBackup(db)
    expect(payload.version).toBe(BACKUP_VERSION)
    expect(payload.currentPrices).toHaveLength(1)
  })
})

describe('importBackup', () => {
  it('restaure les prix dans une base vide', async () => {
    await importBackup(db, {
      version: BACKUP_VERSION,
      currentPrices: [{ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 }],
      priceHistory: [], sales: [], settings: DEFAULT_SETTINGS,
    })
    expect((await makePriceRepository(db).loadPriceBook()).get(5)?.kamas).toBe(100)
  })

  it('remplace intégralement le contenu existant', async () => {
    await makePriceRepository(db).record({ itemId: 9, kamas: 999, lotSize: 1, observedAt: 1 })
    await importBackup(db, {
      version: BACKUP_VERSION,
      currentPrices: [{ itemId: 5, kamas: 100, lotSize: 1, observedAt: 1000 }],
      priceHistory: [], sales: [], settings: DEFAULT_SETTINGS,
    })
    const book = await makePriceRepository(db).loadPriceBook()
    expect(book.has(9)).toBe(false)
    expect(book.has(5)).toBe(true)
  })

  it('refuse une sauvegarde de version inconnue', async () => {
    await expect(importBackup(db, {
      version: 999, currentPrices: [], priceHistory: [], sales: [], settings: DEFAULT_SETTINGS,
    })).rejects.toThrow(/version/i)
  })

  it('restaure les réglages', async () => {
    await importBackup(db, {
      version: BACKUP_VERSION, currentPrices: [], priceHistory: [], sales: [],
      settings: { ...DEFAULT_SETTINGS, jobLevels: { forgeron: 77 } },
    })
    expect((await makeSettingsRepository(db).load()).jobLevels).toEqual({ forgeron: 77 })
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Lancer : `npm test -- backup`
Attendu : ÉCHEC, `Failed to resolve import "./backup"`

- [ ] **Step 3: Écrire l'implémentation**

`src/store/backup.ts` :

```typescript
import type { KrosmargeDB, CurrentPriceRow, PriceHistoryRow } from './db'
import type { Sale } from '../domain/sale'
import type { AppSettings } from './repositories'

export const BACKUP_VERSION = 1

export interface BackupPayload {
  version: number
  currentPrices: CurrentPriceRow[]
  priceHistory: PriceHistoryRow[]
  sales: Sale[]
  settings: AppSettings
}

export async function exportBackup(db: KrosmargeDB): Promise<BackupPayload> {
  const [currentPrices, priceHistory, sales, settingsRow] = await Promise.all([
    db.currentPrices.toArray(),
    db.priceHistory.toArray(),
    db.sales.toArray(),
    db.settings.get('app'),
  ])
  return {
    version: BACKUP_VERSION,
    currentPrices,
    priceHistory,
    sales,
    settings: (settingsRow?.value ?? {}) as AppSettings,
  }
}

/**
 * Restauration destructive : le contenu existant est remplacé. Les relevés de
 * prix représentent l'investissement du joueur dans l'outil, l'interface doit
 * donc demander confirmation avant d'appeler cette fonction.
 */
export async function importBackup(db: KrosmargeDB, payload: BackupPayload): Promise<void> {
  if (payload.version !== BACKUP_VERSION) {
    throw new Error(`Version de sauvegarde non prise en charge : ${payload.version}`)
  }
  await db.transaction('rw', db.currentPrices, db.priceHistory, db.sales, db.settings, async () => {
    await Promise.all([db.currentPrices.clear(), db.priceHistory.clear(), db.sales.clear(), db.settings.clear()])
    await db.currentPrices.bulkAdd(payload.currentPrices)
    await db.priceHistory.bulkAdd(payload.priceHistory)
    await db.sales.bulkAdd(payload.sales)
    await db.settings.put({ key: 'app', value: payload.settings })
  })
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Lancer : `npm test -- backup`
Attendu : SUCCÈS, 5 tests

- [ ] **Step 5: Écrire l'écran de réglages**

`src/ui/screens/SettingsScreen.tsx` :

```tsx
import { useRef, useState } from 'react'
import { useAppState } from '../AppState'
import { JOB_LABELS, type Job } from '../../catalog/types'
import { db } from '../../store/db'
import { exportBackup, importBackup, type BackupPayload } from '../../store/backup'
import { RUNES } from '../../catalog/statWeights'

const CRAFT_JOBS: Job[] = [
  'tailleur', 'bijoutier', 'cordonnier', 'forgeron',
  'sculpteur', 'faconneur', 'bricoleur', 'alchimiste',
]

export function SettingsScreen() {
  const { catalog, settings, saveSettings } = useAppState()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const setJobLevel = (job: Job, level: number) =>
    void saveSettings({ ...settings, jobLevels: { ...settings.jobLevels, [job]: level } })

  const download = async () => {
    const payload = await exportBackup(db)
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `krosmarge-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const upload = async (file: File) => {
    if (!confirm('Cette restauration remplace tes prix et tes ventes actuels. Continuer ?')) return
    try {
      await importBackup(db, JSON.parse(await file.text()) as BackupPayload)
      setMessage('Sauvegarde restaurée. Recharge la page.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import impossible')
    }
  }

  return (
    <section className="settings">
      <h2>Niveaux de métier</h2>
      <p className="settings__hint">
        Seuls les crafts que ces niveaux autorisent apparaissent dans le classement.
      </p>
      {CRAFT_JOBS.map((job) => (
        <label key={job} className="settings__job">
          <span>{JOB_LABELS[job]}</span>
          <input
            type="number" min={0} max={200}
            value={settings.jobLevels[job] ?? 0}
            onChange={(e) => setJobLevel(job, Math.min(200, Math.max(0, Number(e.target.value))))}
          />
        </label>
      ))}

      <h2>Fraîcheur des prix</h2>
      <label>
        <span>Frais en deçà de (heures)</span>
        <input
          type="number" min={1}
          value={settings.freshness.freshHours}
          onChange={(e) => void saveSettings({
            ...settings,
            freshness: { ...settings.freshness, freshHours: Number(e.target.value) },
          })}
        />
      </label>
      <label>
        <span>Périmé au-delà de (heures)</span>
        <input
          type="number" min={1}
          value={settings.freshness.staleHours}
          onChange={(e) => void saveSettings({
            ...settings,
            freshness: { ...settings.freshness, staleHours: Number(e.target.value) },
          })}
        />
      </label>

      <h2>Runes de brisage</h2>
      <p className="settings__hint">
        Associe chaque statistique à sa rune dans le catalogue. Les statistiques
        non associées sont ignorées par l'estimation de brisage.
      </p>
      {RUNES.map((rune) => (
        <label key={rune.statName} className="settings__rune">
          <span>{rune.statName}</span>
          <input
            type="number" min={0}
            value={settings.runeItemIds[rune.statName] ?? 0}
            onChange={(e) => void saveSettings({
              ...settings,
              runeItemIds: { ...settings.runeItemIds, [rune.statName]: Number(e.target.value) },
            })}
          />
          <span className="settings__rune-name">
            {catalog!.itemsById.get(settings.runeItemIds[rune.statName] ?? 0)?.name ?? 'non associée'}
          </span>
        </label>
      ))}

      <h2>Sauvegarde</h2>
      <button onClick={() => void download()}>Exporter mes données</button>
      <button onClick={() => fileInput.current?.click()}>Importer une sauvegarde</button>
      <input
        ref={fileInput} type="file" accept="application/json" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }}
      />
      {message && <p className="settings__message">{message}</p>}

      <h2>Catalogue</h2>
      <p>Version {catalog!.version} — {catalog!.itemsById.size} objets, {catalog!.recipeByResultId.size} recettes.</p>
    </section>
  )
}
```

- [ ] **Step 6: Brancher dans App.tsx**

Remplacer `{tab === 'settings' && <p>Réglages</p>}` par `{tab === 'settings' && <SettingsScreen />}`.

- [ ] **Step 7: Vérifier**

Lancer : `npm test`
Attendu : SUCCÈS, tous les tests

Lancer : `npm run dev`
Attendu : modifier un niveau de métier fait apparaître des crafts ; l'export télécharge un JSON ; le réimporter restaure l'état.

- [ ] **Step 8: Commit**

```bash
git add src/store/backup.ts src/store/backup.test.ts src/ui/
git commit -m "feat: réglages, association des runes et sauvegarde exportable"
```

---

## Task 18: Installation PWA et cache hors-ligne

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon-192.png`, `public/icon-512.png`

**Interfaces:**
- Consumes: la configuration Vite existante
- Produces: manifeste d'application et service worker

- [ ] **Step 1: Configurer vite-plugin-pwa**

`vite.config.ts` — ajouter le plugin :

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Krosmarge — Rentabilité Dofus Touch',
        short_name: 'Krosmarge',
        description: 'Classement des crafts Dofus Touch par marge nette réelle.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#111318',
        theme_color: '#111318',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Le catalogue dépasse la limite par défaut de 2 Mio.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Icônes du CDN Ankama : mises en cache à la consultation.
            // Les embarquer alourdirait le bundle de plusieurs mégaoctets.
            urlPattern: /^https:\/\/s\.ankama\.com\/.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ankama-icons',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 2: Ajouter les métadonnées mobiles**

Dans `index.html`, à l'intérieur de `<head>` :

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#111318" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<title>Krosmarge</title>
```

Régler `<html lang="fr">`.

- [ ] **Step 3: Produire les icônes**

Créer `public/icon.svg` en reprenant `--k-bg` et `--k-accent` du thème établi à la tâche 12 :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#111318"/>
  <text x="256" y="330" font-family="system-ui, sans-serif" font-size="260"
        font-weight="700" text-anchor="middle" fill="#e8b64c">K</text>
</svg>
```

Puis produire les deux PNG :

```bash
npm install -D sharp
node -e "const s=require('sharp');for(const n of [192,512])s('public/icon.svg').resize(n,n).png().toFile('public/icon-'+n+'.png')"
```

Vérifier que le monogramme reste lisible à 48 px avant de continuer.

- [ ] **Step 4: Vérifier l'installation et le hors-ligne**

```bash
npm run build:catalog
npm run build
npm run preview
```

Dans les outils de développement du navigateur :
1. Onglet Application → Manifest : le manifeste est détecté, sans avertissement.
2. Onglet Application → Service Workers : un service worker est actif.
3. Onglet Réseau → cocher « Offline », puis recharger.

Attendu : l'application démarre hors-ligne, la navigation et le classement fonctionnent, les icônes déjà consultées s'affichent, les autres montrent leur emplacement vide.

- [ ] **Step 5: Vérifier la suite complète**

Lancer : `npm test`
Attendu : SUCCÈS, tous les tests

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts index.html public/
git commit -m "feat: manifeste PWA, service worker et cache des icônes à la consultation"
```

---

## Récapitulatif de couverture

| Exigence de la spec | Tâche |
|---|---|
| §3.2 Table type → métier | 2 |
| §5.1 Catalogue et types | 2, 3, 4 |
| §5.2 Prix avec taille de lot | 1, 11 |
| §5.3 Ventes et coût figé | 10, 11 |
| §5.4 Réglages | 11, 17 |
| §6.1 Coût, taxe, marge | 5, 6 |
| §6.2 Fraîcheur et confiance | 7 |
| §6.3 Priorité du relevé | 8 |
| §6.4 Brisage | 9 |
| §7.1 Écran Crafts | 13 |
| §7.2 Détail d'un craft | 14 |
| §7.3 Relevé guidé et recherche | 15 |
| §7.4 Ventes | 16 |
| §7.5 Réglages, export/import | 17 |
| §8 Architecture en couches | 1, 11, 12 |
| §8 Génération du catalogue | 4 |
| §8 Cache des icônes | 18 |
| §9 Tests du domaine | 1, 5, 6, 7, 8, 9, 10 |
