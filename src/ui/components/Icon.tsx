import type { ReactNode } from 'react'

/**
 * Pictogrammes SVG en ligne.
 *
 * Pourquoi du SVG et pas des emoji : la checklist de livraison de la skill
 * `ui-ux-pro-max` proscrit l'emoji comme icône, et pour une bonne raison sur
 * mobile — un emoji est rendu par la police système, donc différemment sur
 * Android, iOS et d'une version à l'autre. Un pictogramme de barre d'onglets
 * doit être prévisible.
 *
 * Pourquoi en ligne et pas une bibliothèque : Krosmarge fonctionne hors ligne
 * et n'a besoin que de huit dessins. Une dépendance d'icônes coûterait plus
 * cher en octets que les quelques chemins ci-dessous.
 *
 * Toutes les icônes héritent de `currentColor` : aucune couleur n'est écrite
 * ici, la teinte vient de la règle CSS qui porte l'icône.
 */

/** Les quatre onglets, puis les quatre niveaux de fraîcheur. */
export type IconName =
  | 'crafts'
  | 'prices'
  | 'sales'
  | 'settings'
  | 'fresh'
  | 'stale'
  | 'expired'
  | 'missing'

interface Glyph {
  body: ReactNode
  /** Épaisseur de trait propre au dessin, quand 2 ne convient pas. */
  stroke?: number
}

/*
 * Les quatre icônes d'onglet suivent la convention Lucide : viewBox 24×24,
 * trait de 2, extrémités et jointures arrondies, aucun remplissage.
 *
 * Les quatre marques de fraîcheur, elles, se distinguent d'abord par leur
 * silhouette — disque plein, demi-disque, anneau vide, point d'interrogation —
 * et seulement ensuite par leur teinte. La spec l'exige : l'information ne
 * doit jamais reposer sur la seule couleur. Mesuré, le contraste de luminance
 * entre les quatre teintes ne dépasse pas 1,61:1 ; sans la forme, les quatre
 * états seraient indiscernables en vision dichromatique.
 */
const GLYPHS: Record<IconName, Glyph> = {
  // Marteau : le métier d'artisanat.
  crafts: {
    body: <path d="M14.5 3.5 20.5 9.5 17.5 12.5 15 10 6.5 18.5a2.1 2.1 0 0 1-3-3L12 7l-2.5-2.5z" />,
  },
  // Billet : le relevé des prix de l'hôtel de vente.
  prices: {
    body: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2.5" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 12h.01" />
        <path d="M18 12h.01" />
      </>
    ),
  },
  // Carton : les lots mis en vente.
  sales: {
    body: (
      <>
        <path d="M12 3 21 8v8l-9 5-9-5V8z" />
        <path d="M3 8l9 5 9-5" />
        <path d="M12 13v8" />
      </>
    ),
  },
  /*
   * Engrenage à huit dents. Le contour a été calculé (rayon de tête 9,6,
   * rayon de pied 6,9, dent de 26°) plutôt que recopié : à trait de 2 les
   * creux se rempliraient, d'où le trait affiné à 1,7 pour cette icône seule.
   * Sa longueur de tracé supérieure lui rend malgré tout le même poids visuel
   * que les trois autres.
   */
  settings: {
    stroke: 1.7,
    body: (
      <>
        <path d="M9.84 2.65 14.16 2.65 14.13 5.44 15.13 5.85 17.09 3.86 20.14 6.91 18.15 8.87 18.56 9.87 21.35 9.84 21.35 14.16 18.56 14.13 18.15 15.13 20.14 17.09 17.09 20.14 15.13 18.15 14.13 18.56 14.16 21.35 9.84 21.35 9.87 18.56 8.87 18.15 6.91 20.14 3.86 17.09 5.85 15.13 5.44 14.13 2.65 14.16 2.65 9.84 5.44 9.87 5.85 8.87 3.86 6.91 6.91 3.86 8.87 5.85 9.87 5.44Z" />
        <circle cx="12" cy="12" r="3.2" />
      </>
    ),
  },

  // Disque plein : le prix vient d'être relevé.
  fresh: {
    body: <circle cx="12" cy="12" r="7.5" fill="currentColor" stroke="none" />,
  },
  // Demi-disque : le prix vieillit mais reste exploitable.
  stale: {
    stroke: 2.6,
    body: (
      <>
        <path d="M12 4.5a7.5 7.5 0 0 0 0 15z" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="7.5" />
      </>
    ),
  },
  // Anneau vide : le prix est périmé.
  expired: {
    stroke: 3,
    body: <circle cx="12" cy="12" r="7" />,
  },
  // Point d'interrogation : aucun prix n'a jamais été relevé.
  missing: {
    stroke: 2.8,
    body: (
      <>
        <path d="M8.6 9.2a3.6 3.6 0 0 1 6.9 1.2c0 2.4-3.5 3.1-3.5 5.2" />
        <path d="M12 19.4h.01" />
      </>
    ),
  },
}

export interface IconProps {
  name: IconName
  /** Côté du carré, en pixels. 22 dans la barre d'onglets, 14 dans une liste. */
  size?: number
  className?: string
}

/**
 * Pictogramme SVG en ligne, à la couleur du texte environnant.
 *
 * Décoratif par défaut (`aria-hidden`) : partout où il sert, le sens est déjà
 * porté par un libellé visible ou par l'`aria-label` du parent. L'annoncer une
 * seconde fois ne ferait que bavarder au lecteur d'écran.
 */
export function Icon({ name, size = 24, className }: IconProps) {
  const glyph = GLYPHS[name]
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={glyph.stroke ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph.body}
    </svg>
  )
}
