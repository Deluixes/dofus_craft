/**
 * Espace fine insécable (U+202F). Insécable pour qu'un montant ne se coupe
 * jamais entre ses milliers ou avant son unité sur un écran étroit ; fine
 * parce que la convention typographique française l'exige pour les nombres.
 */
const SEPARATOR = '\u202f'

/** Valeur inconnue : tiret cadratin, jamais « 0 » — un prix absent n'est pas nul. */
const UNKNOWN = '—'

export interface FormatKamasOptions {
  /** Force le signe « + » devant un montant positif (utile pour une variation). */
  signed?: boolean
}

/**
 * Met un montant en kamas au format d'affichage : arrondi à l'entier, milliers
 * séparés, unité suffixée. `null` et `NaN` donnent le tiret cadratin.
 */
export function formatKamas(value: number | null, opts: FormatKamasOptions = {}): string {
  if (value === null || Number.isNaN(value)) return UNKNOWN
  const rounded = Math.round(value)
  const body = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATOR)
  const sign = rounded < 0 ? '-' : opts.signed ? '+' : ''
  return `${sign}${body}${SEPARATOR}k`
}

export interface KamasAmountProps {
  value: number | null
  signed?: boolean
  className?: string
}

/**
 * Montant en kamas coloré par son signe. La teinte vient de `data-tone`, que
 * le thème interprète : aucun composant ne code de couleur en dur.
 */
export function KamasAmount({ value, signed, className }: KamasAmountProps) {
  const tone = value === null ? 'neutral' : value < 0 ? 'negative' : 'positive'
  return (
    <span className={className} data-tone={tone}>
      {formatKamas(value, { signed })}
    </span>
  )
}
