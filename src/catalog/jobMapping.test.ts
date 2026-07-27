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
