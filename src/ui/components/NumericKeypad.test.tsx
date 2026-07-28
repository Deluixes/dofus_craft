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
