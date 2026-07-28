import { describe, it, expect } from 'vitest'
import { jobForType, TYPE_TO_JOB } from './jobMapping'
import { JOB_LABELS } from './types'

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

describe('jobForType — amendement post-tâche 4', () => {
  it('attribue les trois types d\'élevage à l\'Éleveur', () => {
    expect(jobForType("Objet d'élevage")).toBe('eleveur')
    expect(jobForType('Fantôme de Familier')).toBe('eleveur')
    expect(jobForType('Fantôme de Montilier')).toBe('eleveur')
  })

  it('garde Boucher, Poissonnier et Boulanger distincts', () => {
    // Dofus Touch est figé sur une base 2.x antérieure à la fusion
    // des métiers : ces trois-là ne sont PAS Chasseur / Pêcheur / Paysan.
    expect(jobForType('Viande conservée')).toBe('boucher')
    expect(jobForType('Poisson vidé')).toBe('poissonnier')
    expect(jobForType('Farine')).toBe('boulanger')
  })

  it('attribue les potions utilitaires à l\'Alchimiste', () => {
    expect(jobForType("Potion d'oubli de métier")).toBe('alchimiste')
    expect(jobForType("Potion d'oubli Percepteur")).toBe('alchimiste')
    expect(jobForType('Potion Cosmétique')).toBe('alchimiste')
    expect(jobForType('Potion de conquête')).toBe('alchimiste')
  })

  it('attribue les types résolus via dofusdb', () => {
    expect(jobForType('Pierre précieuse')).toBe('mineur')
    expect(jobForType('Pioche')).toBe('forgeron')
    expect(jobForType('Bois')).toBe('bucheron')
    expect(jobForType('Poudre')).toBe('paysan')
    expect(jobForType('Outil')).toBe('sculpteur')
  })

  it('laisse en inconnu les types qu\'aucune source ne tranche', () => {
    // 60 recettes résiduelles, assumées : aucune source fiable ne les résout.
    expect(jobForType('Pierre magique')).toBe('inconnu')
    expect(jobForType('Sac à dos')).toBe('inconnu')
    expect(jobForType("Fée d'artifice")).toBe('inconnu')
    expect(jobForType('Metaria')).toBe('inconnu')
    expect(jobForType('Graine')).toBe('inconnu')
  })

  it('expose un libellé pour chaque valeur de Job', () => {
    const jobs = Object.values(TYPE_TO_JOB)
    for (const job of jobs) {
      expect(JOB_LABELS[job], `libellé manquant pour ${job}`).toBeTruthy()
    }
    expect(JOB_LABELS.eleveur).toBe('Éleveur')
    expect(JOB_LABELS.boucher).toBe('Boucher')
    expect(JOB_LABELS.poissonnier).toBe('Poissonnier')
    expect(JOB_LABELS.boulanger).toBe('Boulanger')
  })
})
