import type { LotSize } from '../../domain/types'

const LOTS: LotSize[] = [1, 10, 100]

/**
 * Sélecteur de taille de lot (×1, ×10, ×100).
 *
 * Les classes `.lot-selector` et `.lot-selector__option[aria-pressed='true']`
 * font partie du contrat de tokens partagé depuis la tâche 12 : ce composant
 * ne fait qu'en consommer le style, il n'en introduit pas de nouveau.
 */
export function LotSelector({ value, onChange }: {
  value: LotSize
  onChange: (lot: LotSize) => void
}) {
  return (
    <div className="lot-selector" role="group" aria-label="Taille du lot">
      {LOTS.map((lot) => (
        <button
          key={lot}
          type="button"
          aria-pressed={value === lot}
          className="lot-selector__option"
          onClick={() => onChange(lot)}
        >
          ×{lot}
        </button>
      ))}
    </div>
  )
}
