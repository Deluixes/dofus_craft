import { describe, it, expect } from 'vitest'
import { startOfDay, toDateInput, fromDateInput } from './clock'
import { dayKey } from '../domain/ledger'

describe('startOfDay', () => {
  it('ramène un instant à minuit local', () => {
    const noon = new Date(2026, 8, 7, 12, 34, 56, 789).getTime()
    expect(startOfDay(noon)).toBe(new Date(2026, 8, 7).getTime())
  })

  it('est idempotent', () => {
    const midnight = new Date(2026, 8, 7).getTime()
    expect(startOfDay(startOfDay(midnight))).toBe(midnight)
  })
})

describe('aller-retour avec le champ date', () => {
  it('relit exactement le jour saisi', () => {
    expect(toDateInput(fromDateInput('2026-09-07'))).toBe('2026-09-07')
  })

  it('ne recule pas dun jour, contrairement à new Date sur une chaîne ISO', () => {
    /*
     * new Date('2026-09-07') est interprete en UTC par la norme : a l'ouest de
     * Greenwich, il tombe le 6 au soir en heure locale. Construire la date
     * composante par composante evite ce piege classique.
     */
    expect(fromDateInput('2026-09-07')).toBe(new Date(2026, 8, 7).getTime())
  })

  it('alimente le regroupement par période avec le bon jour', () => {
    // C'est l'invariant qui compte : ce que l'utilisateur saisit est ce que le
    // bilan compte.
    for (const value of ['2026-01-01', '2026-03-29', '2026-06-15', '2026-12-31']) {
      expect(dayKey(fromDateInput(value))).toBe(value)
    }
  })

  it('retombe sur aujourdhui pour une saisie vide', () => {
    expect(dayKey(fromDateInput(''))).toBe(dayKey(Date.now()))
  })
})
