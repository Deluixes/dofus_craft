export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'back' | 'clear'

const MAX_DIGITS = 9

/** Applique une touche à la saisie courante. Fonction pure, testée isolément. */
export function applyKey(current: string, key: KeypadKey): string {
  if (key === 'clear') return ''
  if (key === 'back') return current.slice(0, -1)
  if (current === '' && (key === '0' || key === '000')) return ''
  const next = current + key
  return next.length > MAX_DIGITS ? current : next
}

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back']

const LABELS: Partial<Record<KeypadKey, string>> = { back: '⌫' }

/**
 * Pavé numérique du relevé de prix — la surface la plus sollicitée de
 * l'application. Les touches sont volontairement grandes et espacées (voir
 * `.keypad__key` dans theme.css) : ici, la générosité de taille prime sur la
 * densité, pour un pouce qui tape à l'aveugle, la nuit.
 */
export function NumericKeypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  return (
    <div className="keypad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="keypad__key"
          onClick={() => onKey(key)}
          aria-label={key === 'back' ? 'Effacer' : key}
        >
          {LABELS[key] ?? key}
        </button>
      ))}
    </div>
  )
}
