import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { PricesScreen } from './PricesScreen'
import { buildCatalogIndex } from '../../catalog/loadCatalog'
import { DEFAULT_FRESHNESS } from '../../domain/freshness'
import type { Catalog, CatalogIndex, Item } from '../../catalog/types'
import type { AppSettings } from '../../store/repositories'
import type { PriceBook } from '../../domain/types'

/*
 * Premier test d'écran de la branche.
 *
 * La revue finale a identifié la cause commune de quatre défauts de câblage :
 * aucun des cinq écrans n'avait de test. Les 116 tests précédents couvraient le
 * domaine à fond, le catalogue, le stockage, et deux fonctions utilitaires
 * d'UI — c'est-à-dire tout sauf l'endroit où le domaine et l'interface se
 * rencontrent, où vivaient les bugs.
 *
 * `useAppState` est remplacé plutôt que `AppStateProvider` monté : le provider
 * ouvre IndexedDB et lit `loadCatalog` par `fetch`, deux dépendances qui ne
 * disent rien de ce qu'on vérifie ici. L'écran, lui, tourne pour de vrai.
 */

interface MockState {
  catalog: CatalogIndex | null
  priceBook: PriceBook
  settings: AppSettings
  recordPrice: (itemId: number, kamas: number, lotSize: number) => Promise<void>
}

let mockState: MockState

vi.mock('../AppState', () => ({ useAppState: () => mockState }))

const CATALOG: Catalog = {
  version: 't',
  items: [
    { id: 1, name: 'Chapeau du Bouftou', type: 'Chapeau', level: 20, imgUrl: '', stats: [] },
    { id: 2, name: 'Cuir du Bouftou', type: 'Peau', level: 1, imgUrl: '', stats: [] },
  ],
  recipes: [
    { resultItemId: 1, job: 'tailleur', ingredients: [{ itemId: 2, quantity: 3 }] },
  ],
}

const settingsWith = (jobLevels: AppSettings['jobLevels']): AppSettings => ({
  jobLevels,
  freshness: DEFAULT_FRESHNESS,
  runeItemIds: {},
})

function setup(catalog: CatalogIndex, settings: AppSettings) {
  const recordPrice = vi.fn<MockState['recordPrice']>(async () => {})
  mockState = { catalog, priceBook: new Map(), settings, recordPrice }
  render(<PricesScreen target={null} onTargetHandled={() => {}} />)
  return { recordPrice }
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup() })

describe('PricesScreen — file vide, aucun métier déclaré', () => {
  it('accueille le joueur et le renvoie vers les Réglages', () => {
    // Régression : `jobLevels = {}` ne rend aucune recette craftable, la file
    // est donc vide, et `cursor (0) >= queue.length (0)` affichait le
    // récapitulatif de FIN de session à la toute première ouverture.
    setup(buildCatalogIndex(CATALOG), settingsWith({}))

    expect(screen.getByText(/Réglages/)).toBeInTheDocument()
    expect(screen.queryByText(/prix relevé/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Aucun nouveau craft rentable/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nouvelle session' })).not.toBeInTheDocument()
  })

  it('ne renvoie pas aux Réglages quand un métier est déclaré mais trop bas', () => {
    setup(buildCatalogIndex(CATALOG), settingsWith({ tailleur: 5 }))

    expect(screen.getByText(/à la portée de tes niveaux de métier/)).toBeInTheDocument()
    expect(screen.queryByText(/Aucun nouveau craft rentable/)).not.toBeInTheDocument()
  })
})

describe('PricesScreen — identifiant inconnu dans la file', () => {
  /**
   * Catalogue percé : l'identifiant 3955 est présent dans `itemsById` — donc
   * `surveyPriority` le laisse entrer dans la file — mais ne s'y résout en
   * aucun objet. C'est la situation exacte que produisait un ingrédient
   * orphelin avant le correctif du domaine, reproduite ici indépendamment de
   * lui : ce test vérifie les bretelles (l'écran), pas la ceinture (le filtre).
   */
  const holed = () => {
    const index = buildCatalogIndex({
      ...CATALOG,
      recipes: [
        {
          resultItemId: 1,
          job: 'tailleur',
          ingredients: [{ itemId: 2, quantity: 3 }, { itemId: 3955, quantity: 1 }],
        },
      ],
    })
    index.itemsById.set(3955, undefined as unknown as Item)
    return index
  }

  it('nest jamais un cul-de-sac : « Passer » reste accessible à chaque position', () => {
    setup(holed(), settingsWith({ tailleur: 200 }))

    let sawUnknown = false
    // Trois entrées de file (résultat + deux ingrédients) : on les parcourt
    // toutes, en exigeant une sortie à chacune.
    for (let position = 0; position < 3; position++) {
      const skip = screen.queryByRole('button', { name: 'Passer' })
      expect(skip, `aucune sortie à la position ${position + 1}`).not.toBeNull()
      if (screen.queryByText(/Objet inconnu du catalogue/)) {
        sawUnknown = true
        // Sur cette entrée, « Valider » n'a pas de sens : enregistrer un prix
        // pour un identifiant sans objet produirait une donnée inexploitable.
        expect(screen.queryByRole('button', { name: 'Valider' })).toBeNull()
      }
      fireEvent.click(skip!)
    }

    expect(sawUnknown, 'la file na jamais présenté lidentifiant orphelin').toBe(true)
  })
})

describe('PricesScreen — pavé numérique et validation', () => {
  it('enregistre le prix saisi et avance dans la file', async () => {
    const { recordPrice } = setup(buildCatalogIndex(CATALOG), settingsWith({ tailleur: 200 }))

    // Deux entrées : le Chapeau (objet résultat) puis le Cuir.
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    const first = screen.getByRole('heading', { level: 1 }).textContent

    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: '000' }))
    expect(screen.getByText(/45.000.k/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(recordPrice).toHaveBeenCalledTimes(1))
    expect(recordPrice.mock.calls[0][1]).toBe(45_000)
    expect(recordPrice.mock.calls[0][2]).toBe(1)

    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(first)
  })

  it('nactive « Valider » quune fois un montant saisi', () => {
    setup(buildCatalogIndex(CATALOG), settingsWith({ tailleur: 200 }))
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    expect(screen.getByRole('button', { name: 'Valider' })).toBeEnabled()
  })
})
