import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/*
 * Pourquoi ce test vit dans `tests/` et non dans `src/ui/`.
 *
 * Il audite un fichier source comme du texte, ce que seul `node:fs` permet :
 * `import './theme.css'` passerait par le pipeline de Vite, et `?raw` renvoie
 * une chaîne vide dès que le plugin Tailwind intercepte le fichier (constaté).
 * Or `node:fs` demande les types Node, que tsconfig.app.json n'expose
 * volontairement pas — c'est ce qui empêche aujourd'hui une couche métier
 * d'importer un module Node par inadvertance. Plutôt que d'ouvrir cette porte
 * pour un seul test, le test rejoint tsconfig.node.json, le projet des outils
 * de build, auquel il appartient réellement : il ne teste pas du code de
 * navigateur, il vérifie une source.
 */
const CSS = readFileSync('src/ui/theme.css', 'utf8')

/*
 * Régression sur la palette sémantique.
 *
 * Deux quasi-collisions ont échappé aux revues successives, et la seule chose
 * qui les tenait à distance était un tableau recopié dans un rapport de tâche.
 * Ce fichier relit les valeurs depuis theme.css et recalcule la matrice, si
 * bien qu'un retunage de token ne peut plus se glisser sans le dire.
 *
 * Correction apportée au constat de la revue finale. Celle-ci annonçait
 * « --k-accent / --k-missing à 40,1° et --k-negative / --k-stale à 43,3° » comme
 * les deux marges les plus minces, sur un plancher de 40°. Les deux chiffres
 * sont exacts (le test les vérifie), mais ce ne sont pas les plus serrés :
 * --k-fresh et --k-missing ne sont séparés que de 16,6° de teinte. Un test
 * appliquant 40° à l'ensemble des 28 paires échouerait donc dès aujourd'hui.
 *
 * La règle réellement appliquée par la palette, telle que l'énonce l'en-tête de
 * theme.css, ne porte que sur les « teintes saturées » : --k-neutral et
 * --k-missing sont une ardoise volontairement désaturée (20,2 %), à laquelle la
 * teinte ne sert pas de signal. Ce qui les distingue d'un bleu ciel, ce n'est
 * pas l'angle mais la saturation — 73 points d'écart — et, sur les pastilles de
 * fraîcheur, la silhouette dessinée par Icon.tsx.
 *
 * D'où la règle testée ici, qui couvre les 28 paires sans exception :
 *
 *   deux tokens de valeurs différentes doivent se séparer d'au moins 40° de
 *   teinte OU d'au moins 40 points de saturation.
 *
 * Elle contient le plancher de 40° voulu par la revue (le cas général), et
 * nomme explicitement la seule paire de valeurs identiques, pour qu'un
 * troisième doublon ne puisse pas s'y ajouter en silence.
 */

const TOKENS = [
  '--k-positive', '--k-negative', '--k-neutral', '--k-fresh',
  '--k-stale', '--k-expired', '--k-missing', '--k-accent',
] as const

/** Seuils. La teinte est un angle, la saturation un pourcentage : deux échelles
 *  différentes qui portent ici la même exigence — « ces deux couleurs ne se
 *  confondent pas à la lecture rapide, la nuit, sur un téléphone ». */
const MIN_HUE_DEGREES = 40
const MIN_SATURATION_POINTS = 40

/** Seule paire autorisée à partager une valeur : « montant inconnu » et « prix
 *  jamais relevé » sont le même fait, l'absence de donnée (cf. theme.css). */
const DELIBERATE_DUPLICATE = ['--k-neutral', '--k-missing'] as const

interface Hsl { h: number; s: number; l: number }

function readToken(name: string): string {
  const match = CSS.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`Token ${name} introuvable ou non littéral dans theme.css`)
  return match[1].toLowerCase()
}

function toHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  if (h < 0) h += 360

  return { h, s: delta === 0 ? 0 : (delta / (1 - Math.abs(2 * l - 1))) * 100, l: l * 100 }
}

/** Écart de teinte sur le cercle chromatique : 350° et 10° sont à 20°, pas 340°. */
function hueSeparation(a: number, b: number): number {
  const raw = Math.abs(a - b)
  return Math.min(raw, 360 - raw)
}

const HEX = Object.fromEntries(TOKENS.map((t) => [t, readToken(t)])) as Record<string, string>
const HSL = Object.fromEntries(TOKENS.map((t) => [t, toHsl(HEX[t])])) as Record<string, Hsl>

const PAIRS = TOKENS.flatMap((a, i) => TOKENS.slice(i + 1).map((b) => [a, b] as const))

describe('palette sémantique', () => {
  it('couvre les huit tokens et leurs 28 paires', () => {
    expect(TOKENS).toHaveLength(8)
    expect(PAIRS).toHaveLength(28)
  })

  it('sépare chaque paire de couleurs distinctes en teinte ou en saturation', () => {
    const collisions = PAIRS
      .filter(([a, b]) => HEX[a] !== HEX[b])
      .map(([a, b]) => ({
        a, b,
        hue: hueSeparation(HSL[a].h, HSL[b].h),
        sat: Math.abs(HSL[a].s - HSL[b].s),
      }))
      .filter((p) => p.hue < MIN_HUE_DEGREES && p.sat < MIN_SATURATION_POINTS)
      .map((p) =>
        `${p.a} (${HEX[p.a]}) / ${p.b} (${HEX[p.b]}) : ` +
        `${p.hue.toFixed(1)}° de teinte (plancher ${MIN_HUE_DEGREES}°) et ` +
        `${p.sat.toFixed(1)} points de saturation (plancher ${MIN_SATURATION_POINTS})`,
      )

    expect(collisions, `paires trop proches :\n  ${collisions.join('\n  ')}`).toEqual([])
  })

  it('nautorise quun seul doublon de valeur, celui documenté', () => {
    const duplicates = PAIRS.filter(([a, b]) => HEX[a] === HEX[b]).map(([a, b]) => `${a}/${b}`)
    expect(duplicates).toEqual([DELIBERATE_DUPLICATE.join('/')])
  })

  it('garde les marges les plus minces relevées par la revue finale', () => {
    // Ces deux valeurs sont citées par la revue. Les figer ici fait de tout
    // resserrement une régression visible, et non une découverte de plus.
    expect(hueSeparation(HSL['--k-accent'].h, HSL['--k-missing'].h)).toBeCloseTo(40.1, 1)
    expect(hueSeparation(HSL['--k-negative'].h, HSL['--k-stale'].h)).toBeCloseTo(43.3, 1)
  })

  it('applique le plancher de 40° à toutes les paires de teintes saturées', () => {
    // La règle historique de theme.css, formulée telle quelle. Les tokens
    // désaturés (l'ardoise de --k-neutral / --k-missing) en sont exclus par
    // construction : leur teinte ne porte aucun signal.
    const SATURATED = 45
    const saturated = TOKENS.filter((t) => HSL[t].s >= SATURATED)
    expect(saturated).toEqual([
      '--k-positive', '--k-negative', '--k-fresh', '--k-stale', '--k-expired', '--k-accent',
    ])

    const tightest = PAIRS
      .filter(([a, b]) => HSL[a].s >= SATURATED && HSL[b].s >= SATURATED)
      .map(([a, b]) => ({ a, b, hue: hueSeparation(HSL[a].h, HSL[b].h) }))
      .sort((x, y) => x.hue - y.hue)[0]

    expect(
      tightest.hue,
      `paire saturée la plus serrée : ${tightest.a} / ${tightest.b} à ${tightest.hue.toFixed(1)}°`,
    ).toBeGreaterThanOrEqual(MIN_HUE_DEGREES)
  })
})
