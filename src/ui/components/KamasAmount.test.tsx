import { describe, it, expect } from 'vitest'
import { formatKamas } from './KamasAmount'

/**
 * Espace fine insécable (U+202F). Écrite en séquence d'échappement plutôt
 * qu'en littéral : à l'œil elle ne se distingue pas d'une espace ordinaire,
 * et une comparaison de chaînes qui échoue sur ce seul caractère serait
 * indéchiffrable dans un rapport de test.
 */
const FINE = '\u202f'

describe('formatKamas', () => {
  it('sépare les milliers par une espace insécable fine', () => {
    expect(formatKamas(45000)).toBe(`45${FINE}000${FINE}k`)
  })

  it("arrondit à l'entier", () => {
    expect(formatKamas(4500.7)).toBe(`4${FINE}501${FINE}k`)
  })

  it('préfixe explicitement les montants positifs quand demandé', () => {
    expect(formatKamas(1000, { signed: true })).toBe(`+1${FINE}000${FINE}k`)
    expect(formatKamas(-1000, { signed: true })).toBe(`-1${FINE}000${FINE}k`)
  })

  it('affiche un tiret cadratin pour une valeur inconnue', () => {
    expect(formatKamas(null)).toBe('—')
  })
})
