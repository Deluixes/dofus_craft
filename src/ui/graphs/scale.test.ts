import { describe, it, expect } from 'vitest'
import { linearScale, niceTicks, domainWithZero } from './scale'

describe('linearScale', () => {
  it('projette les bornes du domaine sur celles de la plage', () => {
    const s = linearScale([0, 100], [0, 200])
    expect(s(0)).toBe(0)
    expect(s(100)).toBe(200)
    expect(s(50)).toBe(100)
  })

  it('accepte une plage inversée, comme laxe vertical dun SVG', () => {
    // En SVG, y croît vers le bas : le maximum doit se retrouver en haut.
    const s = linearScale([0, 100], [180, 20])
    expect(s(0)).toBe(180)
    expect(s(100)).toBe(20)
  })

  it('projette un domaine plat au milieu plutôt que de diviser par zéro', () => {
    const s = linearScale([42, 42], [0, 200])
    expect(s(42)).toBe(100)
    expect(Number.isNaN(s(42))).toBe(false)
  })

  it('extrapole hors du domaine sans se plaindre', () => {
    expect(linearScale([0, 10], [0, 100])(20)).toBe(200)
  })
})

describe('niceTicks', () => {
  it('rend des valeurs rondes plutôt que des divisions exactes', () => {
    // Quatre graduations demandees donneraient 25 ; on prefere 20, qui est rond.
    expect(niceTicks(0, 100, 4)).toEqual([0, 20, 40, 60, 80, 100])
  })

  it('choisit un pas en 1, 2 ou 5 fois une puissance de dix', () => {
    expect(niceTicks(0, 1000, 4)).toEqual([0, 200, 400, 600, 800, 1000])
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10])
  })

  it('ne retient pas un pas trop grossier faute de mieux', () => {
    /*
     * Un choix par ecart absolu retiendrait ici 5 000 000, soit trois
     * graduations pour tout l'axe. Le rapport, lui, retient 2 000 000.
     */
    expect(niceTicks(0, 12_000_000, 4)).toEqual([
      0, 2_000_000, 4_000_000, 6_000_000, 8_000_000, 10_000_000, 12_000_000,
    ])
  })

  it('couvre les valeurs négatives et inclut zéro', () => {
    expect(niceTicks(-100, 100, 4)).toContain(0)
  })

  it('ne dérive pas sur de grands montants en kamas', () => {
    // Le cumul de flottants produirait 5999999.999999999 sans le ré-arrondi.
    const ticks = niceTicks(0, 12_345_678, 5)
    expect(ticks.every((t) => Number.isInteger(t))).toBe(true)
    expect(ticks[0]).toBe(0)
    expect(ticks.every((t) => t >= 0 && t <= 12_345_678)).toBe(true)
  })

  it('renvoie une seule graduation pour un domaine plat', () => {
    expect(niceTicks(5, 5)).toEqual([5])
  })
})

describe('domainWithZero', () => {
  it('inclut toujours zéro', () => {
    /*
     * Sans cette regle, une serie entierement negative serait dessinee comme
     * une progression : l'axe se recalerait sur ses propres valeurs et la
     * ligne de zero sortirait du cadre.
     */
    expect(domainWithZero([-500, -200, -100])).toEqual([-500, 0])
    expect(domainWithZero([100, 500])).toEqual([0, 500])
  })

  it('encadre des valeurs de part et dautre de zéro', () => {
    expect(domainWithZero([-300, 700])).toEqual([-300, 700])
  })

  it('donne un domaine non dégénéré sans données', () => {
    expect(domainWithZero([])).toEqual([0, 1])
    expect(domainWithZero([0])).toEqual([0, 1])
  })
})
