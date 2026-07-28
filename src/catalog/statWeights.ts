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
