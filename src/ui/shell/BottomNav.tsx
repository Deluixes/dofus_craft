export type TabId = 'crafts' | 'prices' | 'sales' | 'settings'

const TABS: Array<{ id: TabId; label: string; glyph: string }> = [
  { id: 'crafts', label: 'Crafts', glyph: '⚒' },
  { id: 'prices', label: 'Prix', glyph: '⌨' },
  { id: 'sales', label: 'Ventes', glyph: '📦' },
  { id: 'settings', label: 'Réglages', glyph: '⚙' },
]

/**
 * Barre d'onglets ancrée en bas de l'écran : à une main, le pouce n'atteint
 * pas le haut d'un téléphone moderne.
 */
export function BottomNav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="bottom-nav" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className="bottom-nav__tab"
          onClick={() => onChange(tab.id)}
        >
          <span aria-hidden="true">{tab.glyph}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
