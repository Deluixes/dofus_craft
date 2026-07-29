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
  'Bois': 'bucheron',
  'Alliage': 'mineur',
  "Pierre d'âme": 'mineur',
  'Pierre précieuse': 'mineur',       // dofusdb, pureté 62 %
  'Pioche': 'forgeron',               // dofusdb, pureté 100 %
  'Outil': 'sculpteur',               // dofusdb, pureté 50 % — faible confiance, 1 recette Touch
  'Poudre': 'paysan',                 // dofusdb, pureté 67 %

  // ── Amendement post-tâche 4 ────────────────────────────────────────────
  // 483 recettes ressortaient en 'inconnu' faute de ces types. Ni dofusdb
  // (contenu absent de Dofus 3) ni l'encyclopédie Touch (403 Cloudflare) ne
  // pouvaient trancher : les métiers ci-dessous ont été confirmés par le
  // joueur, qui pratique Dofus Touch.
  //
  // Touch est figé sur une base 2.x ANTÉRIEURE à la fusion des métiers :
  // Boucher, Poissonnier et Boulanger y sont encore distincts de Chasseur,
  // Pêcheur et Paysan.
  "Objet d'élevage": 'eleveur',
  'Fantôme de Familier': 'eleveur',
  'Fantôme de Montilier': 'eleveur',
  'Viande conservée': 'boucher',
  'Poisson vidé': 'poissonnier',
  'Farine': 'boulanger',
  "Potion d'oubli de métier": 'alchimiste',
  "Potion d'oubli Percepteur": 'alchimiste',
  'Potion Cosmétique': 'alchimiste',
  'Potion de conquête': 'alchimiste',  // dofusdb, pureté 100 %
}

/** Métier fabriquant ce type d'objet, `inconnu` si non déterminé. */
export function jobForType(type: string): Job {
  return TYPE_TO_JOB[type] ?? 'inconnu'
}
