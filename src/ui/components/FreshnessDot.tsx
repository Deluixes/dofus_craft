import type { Freshness } from '../../domain/types'

const LABELS: Record<Freshness, string> = {
  fresh: 'Prix frais',
  stale: 'Prix acceptable',
  expired: 'Prix périmé',
  missing: 'Prix manquant',
}

// Le glyphe double le code couleur : la fraîcheur reste lisible sans
// dépendre uniquement de la teinte.
const GLYPHS: Record<Freshness, string> = {
  fresh: '●',
  stale: '◐',
  expired: '○',
  missing: '?',
}

/** Pastille de fraîcheur d'un prix relevé. */
export function FreshnessDot({ level }: { level: Freshness }) {
  return (
    <span
      className="freshness-dot"
      data-level={level}
      title={LABELS[level]}
      aria-label={LABELS[level]}
    >
      {GLYPHS[level]}
    </span>
  )
}
