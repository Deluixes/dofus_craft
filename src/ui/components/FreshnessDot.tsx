import type { Freshness } from '../../domain/types'
import { Icon } from './Icon'

const LABELS: Record<Freshness, string> = {
  fresh: 'Prix frais',
  stale: 'Prix acceptable',
  expired: 'Prix périmé',
  missing: 'Prix manquant',
}

/** Côté de la pastille, en pixels — calé sur la hauteur de x du texte de liste. */
const DOT_SIZE = 14

/**
 * Pastille de fraîcheur d'un prix relevé.
 *
 * La forme porte l'information autant que la teinte : disque plein, demi-disque,
 * anneau vide, point d'interrogation. Les quatre couleurs de fraîcheur ne se
 * séparent que de 1,05:1 à 1,61:1 en luminance ; sans la silhouette, un œil
 * dichromate ne les distinguerait pas. Le nom du niveau sert directement de nom
 * d'icône, si bien qu'aucune table de correspondance ne peut se désynchroniser.
 */
export function FreshnessDot({ level }: { level: Freshness }) {
  return (
    <span
      className="freshness-dot"
      data-level={level}
      role="img"
      title={LABELS[level]}
      aria-label={LABELS[level]}
    >
      <Icon name={level} size={DOT_SIZE} />
    </span>
  )
}
