import { useState } from 'react'
import { BottomNav, type TabId } from './shell/BottomNav'
import { AppStateProvider, useAppState } from './AppState'
import { CraftsScreen } from './screens/CraftsScreen'

function Shell() {
  const [tab, setTab] = useState<TabId>('crafts')
  const [detailItemId, setDetailItemId] = useState<number | null>(null)
  const { catalog, error } = useAppState()

  if (error) return <p className="app-error">{error}</p>
  if (!catalog) return <p className="app-loading">Chargement du catalogue…</p>

  return (
    <div className="app">
      <main className="app__main">
        {/* Ces trois marques-places sont remplacées par les vrais écrans
            aux tâches 14 à 17. */}
        {tab === 'crafts' && <CraftsScreen onOpen={setDetailItemId} onSurvey={() => setTab('prices')} />}
        {tab === 'prices' && <p>Prix</p>}
        {tab === 'sales' && <p>Ventes</p>}
        {tab === 'settings' && <p>Réglages</p>}

        {/* Seam vers l'écran de détail de la tâche 14 : pour l'instant,
            un simple accusé de réception de l'objet sélectionné. */}
        {detailItemId !== null && (
          <p className="app-toast" onClick={() => setDetailItemId(null)}>
            Détail de l'objet {detailItemId} — écran à venir (tâche 14)
          </p>
        )}
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
