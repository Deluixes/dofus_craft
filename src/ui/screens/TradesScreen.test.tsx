import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { TradesScreen } from './TradesScreen'
import { buildCatalogIndex } from '../../catalog/loadCatalog'
import { DEFAULT_FRESHNESS } from '../../domain/freshness'
import type { Catalog, CatalogIndex } from '../../catalog/types'
import type { AppSettings } from '../../store/repositories'
import type { PriceBook } from '../../domain/types'
import type { Movement, Trade } from '../../domain/trade'

/*
 * Test de câblage de l'écran Négoce.
 *
 * `docs/dette-technique.md` porte la leçon de la revue précédente : les quatre
 * défauts trouvés étaient TOUS entre un domaine correct et un stockage correct,
 * et aucun n'aurait survécu à un test d'écran. Le registre de négoce ajoute
 * trois écrans, d'où celui-ci.
 *
 * `useAppState` est remplacé plutôt que `AppStateProvider` monté : le provider
 * ouvre IndexedDB et lit le catalogue par `fetch`, deux dépendances qui ne
 * disent rien de ce qu'on vérifie. L'écran, lui, tourne pour de vrai.
 */

interface MockState {
  catalog: CatalogIndex | null
  priceBook: PriceBook
  settings: AppSettings
  tradeList: Trade[]
  removeTrade: (id: number) => Promise<void>
  listTrade: (id: number, unitPrice: number, quantity: number, at: number) => Promise<void>
  sellTrade: (id: number, unitPrice: number, quantity: number, at: number) => Promise<void>
  withdrawTrade: (id: number, at: number) => Promise<void>
  dropMovement: (id: number, movementId: string) => Promise<void>
}

let mockState: MockState

vi.mock('../AppState', () => ({ useAppState: () => mockState }))

const CATALOG: Catalog = {
  version: 't',
  items: [
    { id: 1, name: 'Fleur de Lotus', type: 'Fleur', level: 1, imgUrl: '', stats: [] },
    { id: 2, name: 'Coiffe du Bouftou', type: 'Chapeau', level: 20, imgUrl: '', stats: [] },
  ],
  recipes: [],
}

const SETTINGS: AppSettings = {
  jobLevels: {},
  freshness: DEFAULT_FRESHNESS,
  runeItemIds: {},
}

const day = (d: number) => new Date(2026, 0, d).getTime()

let seq = 0
function movement(at: number, unitPrice: number, quantity: number): Movement {
  seq += 1
  return { id: 'm' + seq, at, unitPrice, quantity }
}

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 1,
    itemId: 1,
    origin: 'purchase',
    quantity: 100,
    unitCost: 500,
    acquiredAt: day(5),
    listings: [],
    sales: [],
    createdAt: day(5),
    ...over,
  }
}

function setup(tradeList: Trade[]) {
  const spies = {
    removeTrade: vi.fn(async () => {}),
    listTrade: vi.fn(async () => {}),
    sellTrade: vi.fn(async () => {}),
    withdrawTrade: vi.fn(async () => {}),
    dropMovement: vi.fn(async () => {}),
  }
  mockState = {
    catalog: buildCatalogIndex(CATALOG),
    priceBook: new Map(),
    settings: SETTINGS,
    tradeList,
    ...spies,
  }
  render(<TradesScreen />)
  return spies
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup() })

/*
 * `formatKamas` sépare les milliers par une espace fine insécable (U+202F),
 * imposée par la typographie française et choisie pour qu'un montant ne se
 * coupe jamais en fin de ligne. Testing Library ne la normalise pas en espace
 * ordinaire, d'où ce normaliseur : sans lui, chaque assertion sur un montant
 * échouerait avec un message trompeur de texte introuvable.
 */
const kamasNormalizer = (text: string) => text.replace(/\u202f/g, ' ').trim()

/*
 * Le montant est cherché sur l'élément que `KamasAmount` produit réellement,
 * reconnaissable à son `data-tone`. Sans ce filtre, la requête remonte aussi
 * sur le `<dd>` parent, dont le contenu textuel est identique, et échoue sur un
 * « plusieurs éléments trouvés » qui n'apprend rien.
 */
function kamasAll(value: string, scope?: HTMLElement): HTMLElement[] {
  const queries = scope === undefined ? screen : within(scope)
  return queries
    .queryAllByText(value, { normalizer: kamasNormalizer })
    .filter((el) => el.hasAttribute('data-tone'))
}

/*
 * Le résumé est interrogé par son nom accessible plutôt que globalement : avec
 * une seule opération au registre, le résumé et la ligne affichent forcément le
 * même montant, et une recherche globale en trouverait deux.
 */
const summary = () => screen.getByLabelText('Résumé du négoce')

function kamas(value: string, scope?: HTMLElement): HTMLElement {
  const found = kamasAll(value, scope)
  expect(found.length, `montant « ${value} » attendu une seule fois`).toBe(1)
  return found[0]
}

const noKamas = (value: string, scope?: HTMLElement): HTMLElement | null =>
  kamasAll(value, scope)[0] ?? null

describe('TradesScreen — résumé', () => {
  it('invite à saisir quand le registre est vide', () => {
    setup([])
    expect(screen.getByText(/Aucune opération/)).toBeInTheDocument()
  })

  it('affiche le bénéfice réalisé, le capital immobilisé et le latent', () => {
    /*
     * 100 a 500, 100 mises en vente a 800 (taxe 2 400), 60 vendues.
     *   benefice realise = 48 000 - 30 000 - 2 400 = 15 600
     *   capital immobilise = 40 x 500 = 20 000
     *   latent = 40 x 800 - 20 000 = 12 000
     */
    setup([trade({
      listings: [movement(day(6), 800, 100)],
      sales: [movement(day(8), 800, 60)],
    })])

    expect(screen.getByText('Bénéfice réalisé')).toBeInTheDocument()
    expect(kamas('+15 600 k', summary())).toBeInTheDocument()
    expect(kamas('20 000 k', summary())).toBeInTheDocument()
    expect(kamas('+12 000 k', summary())).toBeInTheDocument()
  })

  it('ne compte pas le stock invendu en perte', () => {
    // Rien de vendu : le benefice ne vaut que les taxes, pas -50 000.
    setup([trade({ listings: [movement(day(6), 800, 100)] })])
    expect(kamas('-2 400 k', summary())).toBeInTheDocument()
    expect(noKamas('-50 000 k', summary())).not.toBeInTheDocument()
  })
})

describe('TradesScreen — regroupement', () => {
  it('range une ligne jamais proposée sous En stock', () => {
    setup([trade()])
    expect(screen.getByRole('heading', { name: 'En stock' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'En vente' })).not.toBeInTheDocument()
  })

  it('range une ligne mise en vente sous En vente', () => {
    setup([trade({ listings: [movement(day(6), 800, 100)] })])
    expect(screen.getByRole('heading', { name: 'En vente' })).toBeInTheDocument()
  })

  it('range une ligne retirée sous En stock, jamais dans lhistorique', () => {
    /*
     * Retire n'est pas vendu : les kamas dorment toujours dans l'objet, la
     * ligne doit rester sous les yeux et non filer dans l'historique.
     */
    setup([trade({ listings: [movement(day(6), 800, 100)], withdrawnAt: day(20) })])
    expect(screen.getByRole('heading', { name: 'En stock' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Historique' })).not.toBeInTheDocument()
  })

  it('range une ligne entièrement vendue sous Historique', () => {
    setup([trade({
      quantity: 10,
      listings: [movement(day(6), 800, 10)],
      sales: [movement(day(8), 800, 10)],
    })])
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument()
  })
})

describe('TradesScreen — lignes', () => {
  it('montre le type de lobjet et ce quil en reste', () => {
    setup([trade({ sales: [movement(day(8), 800, 60)] })])
    expect(screen.getByText(/Fleur · 40\/100 restants/)).toBeInTheDocument()
  })

  it('nomme lobjet depuis le catalogue', () => {
    setup([trade({ itemId: 2 })])
    expect(screen.getByText('Coiffe du Bouftou')).toBeInTheDocument()
  })

  it('reste lisible pour un objet absent du catalogue', () => {
    // Le catalogue date de 2019 : un objet plus recent peut manquer.
    setup([trade({ itemId: 9999 })])
    expect(screen.getByText('Objet 9999')).toBeInTheDocument()
  })
})

describe('TradesScreen — navigation', () => {
  it('ouvre le formulaire de saisie', () => {
    setup([])
    fireEvent.click(screen.getByLabelText('Ajouter une opération'))
    expect(screen.getByRole('heading', { name: 'Nouvelle opération' })).toBeInTheDocument()
  })

  it('ouvre le détail dune ligne au toucher de la carte', () => {
    setup([trade({ listings: [movement(day(6), 800, 100)] })])
    fireEvent.click(screen.getByText('Fleur de Lotus'))
    expect(screen.getByText('Taxes payées')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mises en vente' })).toBeInTheDocument()
  })

  it('propose Remettre en vente et non Mettre en vente pour une ligne déjà proposée', () => {
    setup([trade({ listings: [movement(day(6), 800, 100)] })])
    fireEvent.click(screen.getByText('Fleur de Lotus'))
    expect(screen.getByRole('button', { name: 'Remettre en vente' })).toBeInTheDocument()
  })

  it('demande confirmation avant de supprimer une opération', () => {
    const { removeTrade } = setup([trade()])
    fireEvent.click(screen.getByText('Fleur de Lotus'))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer cette opération' }))
    expect(removeTrade).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Oui, supprimer' }))
    expect(removeTrade).toHaveBeenCalledWith(1)
  })

  it('annonce la taxe avant de confirmer une remise en vente', () => {
    // C'est de l'argent preleve immediatement et jamais rembourse.
    setup([trade({ quantity: 10, listings: [movement(day(6), 800, 10)] })])
    fireEvent.click(screen.getByText('Fleur de Lotus'))
    fireEvent.click(screen.getByRole('button', { name: 'Remettre en vente' }))
    // 3 % de 800 x 10 = 240. Le montant est verifie DANS l'avertissement :
    // la meme somme figure aussi dans les taxes payees et dans l'historique.
    const warning = screen.getByText(/perdue même si/)
    expect(warning.textContent).toContain('-240')
  })

  it('transmet la remise en vente au dernier prix et à la quantité restante', () => {
    const { listTrade } = setup([trade({
      listings: [movement(day(6), 800, 100)],
      sales: [movement(day(8), 800, 60)],
    })])
    fireEvent.click(screen.getByText('Fleur de Lotus'))
    fireEvent.click(screen.getByRole('button', { name: 'Remettre en vente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(listTrade).toHaveBeenCalledWith(1, 800, 40, expect.any(Number))
  })

  it('transmet une vente partielle avec la quantité saisie', () => {
    const { sellTrade } = setup([trade({ listings: [movement(day(6), 800, 100)] })])
    fireEvent.click(screen.getByText('Fleur de Lotus'))
    fireEvent.click(screen.getByRole('button', { name: 'Vendu' }))
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(sellTrade).toHaveBeenCalledWith(1, 800, 25, expect.any(Number))
  })

  it('permet deffacer une mise en vente saisie par erreur', () => {
    // Sans quoi une relance de trop couterait une taxe fantome indelebile.
    const { dropMovement } = setup([trade({ listings: [movement(day(6), 800, 100)] })])
    fireEvent.click(screen.getByText('Fleur de Lotus'))
    fireEvent.click(screen.getByLabelText('Supprimer cette mise en vente'))
    expect(dropMovement).toHaveBeenCalledWith(1, expect.any(String))
  })
})
