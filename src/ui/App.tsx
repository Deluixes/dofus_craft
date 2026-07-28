import { useState } from 'react'
import { BottomNav, type TabId } from './shell/BottomNav'
import { AppStateProvider, useAppState } from './AppState'

function Shell() {
  const [tab, setTab] = useState<TabId>('crafts')
  const { catalog, error } = useAppState()

  if (error) return <p className="app-error">{error}</p>
  if (!catalog) return <p className="app-loading">Chargement du catalogue…</p>

  return (
    <div className="app">
      <main className="app__main">
        {/* Ces quatre marques-places sont remplacées par les vrais écrans
            aux tâches 13 à 17. */}
        {tab === 'crafts' && <p>Crafts</p>}
        {tab === 'prices' && <p>Prix</p>}
        {tab === 'sales' && <p>Ventes</p>}
        {tab === 'settings' && <p>Réglages</p>}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  )
}
