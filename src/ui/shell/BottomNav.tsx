import { Icon } from '../components/Icon'

export type TabId = 'crafts' | 'prices' | 'sales' | 'settings'

/*
 * Les identifiants d'onglet servent aussi de noms d'icône : un onglet ne peut
 * donc pas se retrouver avec le pictogramme d'un autre, le typage l'interdit.
 */
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'crafts', label: 'Crafts' },
  { id: 'prices', label: 'Prix' },
  { id: 'sales', label: 'Ventes' },
  { id: 'settings', label: 'Réglages' },
]

/** Côté du pictogramme, en pixels — assez grand pour se lire d'un coup d'œil. */
const ICON_SIZE = 22

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
          <Icon name={tab.id} size={ICON_SIZE} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
