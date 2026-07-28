import { useState } from 'react'
import { BottomNav, type TabId } from './shell/BottomNav'
import { AppStateProvider, useAppState } from './AppState'
import { CraftsScreen } from './screens/CraftsScreen'
import { CraftDetailScreen } from './screens/CraftDetailScreen'
import { PricesScreen } from './screens/PricesScreen'
import { SalesScreen } from './screens/SalesScreen'

function Shell() {
  const [tab, setTab] = useState<TabId>('crafts')
  const [detailItemId, setDetailItemId] = useState<number | null>(null)
  // Consommé à la tâche 15 : l'objet à préremplir en arrivant sur l'écran Prix.
  const [priceTarget, setPriceTarget] = useState<number | null>(null)
  const { catalog, error } = useAppState()

  if (error) return <p className="app-error">{error}</p>
  if (!catalog) return <p className="app-loading">Chargement du catalogue…</p>

  if (detailItemId !== null) {
    return (
      <CraftDetailScreen
        itemId={detailItemId}
        onClose={() => setDetailItemId(null)}
        onEditPrice={(id) => { setDetailItemId(null); setTab('prices'); setPriceTarget(id) }}
      />
    )
  }

  return (
    <div className="app">
      <main className="app__main">
        {/* Cette marque-place est remplacée par le vrai écran à la tâche 17. */}
        {tab === 'crafts' && <CraftsScreen onOpen={setDetailItemId} onSurvey={() => setTab('prices')} />}
        {tab === 'prices' && (
          <PricesScreen target={priceTarget} onTargetHandled={() => setPriceTarget(null)} />
        )}
        {tab === 'sales' && <SalesScreen />}
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
