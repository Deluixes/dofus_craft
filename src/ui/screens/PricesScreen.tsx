import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { surveyPriority } from '../../domain/surveyPriority'
import { rankCrafts } from '../../domain/craftRanking'
import { freshnessOf, HOUR_MS } from '../../domain/freshness'
import { unitPrice } from '../../domain/price'
import { NumericKeypad, applyKey } from '../components/NumericKeypad'
import { LotSelector } from '../components/LotSelector'
import { FreshnessDot } from '../components/FreshnessDot'
import { KamasAmount, formatKamas } from '../components/KamasAmount'
import type { LotSize } from '../../domain/types'

const QUEUE_LENGTH = 12
const SEARCH_MIN_LENGTH = 3
const SEARCH_RESULT_LIMIT = 20

/**
 * Écran de relevé de prix : file guidée par défaut, recherche libre en
 * complément, un seul objet à la fois derrière un pavé numérique.
 *
 * Le rôle de cet écran n'est pas de collecter des données pour elles-mêmes :
 * c'est le geste répété le plus souvent dans l'app, debout devant l'HDV,
 * probablement d'une seule main. Chaque décision ci-dessous (file figée,
 * mémoire du lot par objet, clavier en pleine largeur) vise à réduire le
 * nombre de gestes entre « je regarde un prix en jeu » et « il est enregistré ».
 */
export function PricesScreen({ target, onTargetHandled }: {
  target: number | null
  onTargetHandled: () => void
}) {
  const { catalog, priceBook, settings, recordPrice } = useAppState()
  const [mode, setMode] = useState<'guided' | 'search'>('guided')
  const [cursor, setCursor] = useState(0)
  const [draft, setDraft] = useState('')
  // Lot mémorisé par objet plutôt qu'une seule valeur globale : le joueur qui
  // achète toujours ses Frênes par cent ne doit pas re-choisir ×100 à chaque
  // relevé, mais un autre objet suivi à l'unité ne doit pas hériter de ce choix.
  const [lotByItem, setLotByItem] = useState<Map<number, LotSize>>(new Map())
  const [recorded, setRecorded] = useState(0)
  const [search, setSearch] = useState('')
  const [manualId, setManualId] = useState<number | null>(null)

  const now = Date.now()

  // Photographie des crafts déjà rentables à l'ouverture de la session, pour
  // pouvoir dire au joueur ce que son relevé a débloqué (recap de fin de
  // session). Lazy initializer : ne s'exécute qu'au montage.
  const [profitableAtStart] = useState(
    () => new Set(
      rankCrafts(catalog!, priceBook, settings.jobLevels, Date.now(), settings.freshness)
        .ranked.filter((c) => c.margin!.net > 0)
        .map((c) => c.resultItemId),
    ),
  )

  const queue = useMemo(
    () => surveyPriority(catalog!, priceBook, settings.jobLevels, Date.now(), settings.freshness)
      .slice(0, QUEUE_LENGTH)
      .map((e) => e.itemId),
    // La file est figée à l'ouverture : la recalculer après chaque saisie
    // réordonnerait la liste sous les doigts du joueur en pleine session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, settings],
  )

  useEffect(() => {
    if (target !== null) { setMode('search'); setManualId(target); onTargetHandled() }
  }, [target, onTargetHandled])

  // Un métier laissé à 0 dans les réglages n'est pas déclaré : il ne rend
  // aucune recette accessible, exactement comme un métier absent de l'objet.
  const hasDeclaredJobs = Object.values(settings.jobLevels).some((level) => (level ?? 0) > 0)

  const currentId = manualId ?? queue[cursor] ?? null
  const item = currentId === null ? null : catalog!.itemsById.get(currentId)
  const existing = currentId === null ? undefined : priceBook.get(currentId)
  const lot = currentId === null ? 1 : (lotByItem.get(currentId) ?? 1)

  const setLot = (next: LotSize) => {
    if (currentId === null) return
    setLotByItem((prev) => new Map(prev).set(currentId, next))
  }

  const advance = () => {
    setDraft('')
    if (manualId !== null) setManualId(null)
    else setCursor((c) => c + 1)
  }

  const submit = async () => {
    if (!currentId || draft === '') return
    await recordPrice(currentId, Number(draft), lot)
    setRecorded((n) => n + 1)
    advance()
  }

  /*
   * File vide n'est pas session terminée.
   *
   * Un nouveau joueur a `jobLevels = {}` ; aucune des 2219 recettes du
   * catalogue n'ayant un résultat de niveau 0, l'ensemble craftable est vide,
   * donc la file aussi, donc `cursor (0) >= queue.length (0)` — et la toute
   * première ouverture de l'onglet Prix affichait un récapitulatif de fin de
   * session : « 0 prix relevé · 0 crafts calculables · Aucun nouveau craft
   * rentable cette fois. » CraftsScreen gérait déjà ce cas correctement.
   *
   * Le test porte sur la file elle-même et non sur `jobLevels` : une file
   * jamais peuplée ne peut avoir été parcourue, quelle qu'en soit la raison.
   * Le message, lui, distingue les deux causes, parce qu'elles n'appellent pas
   * le même geste — déclarer un métier, ou attendre d'en monter un.
   */
  if (mode === 'guided' && queue.length === 0 && manualId === null) {
    return <SurveyWelcome hasJobs={hasDeclaredJobs} onSearch={() => setMode('search')} />
  }

  if (mode === 'guided' && cursor >= queue.length && manualId === null) {
    return (
      <SurveyRecap
        recorded={recorded}
        profitableAtStart={profitableAtStart}
        onRestart={() => { setCursor(0); setRecorded(0) }}
        onSearch={() => setMode('search')}
      />
    )
  }

  return (
    <section className="survey">
      <header className="survey__header">
        <div className="survey__modes" role="group" aria-label="Mode de saisie">
          <button
            type="button"
            className="survey__mode-btn"
            aria-pressed={mode === 'guided'}
            onClick={() => { setMode('guided'); setManualId(null) }}
          >
            Guidé
          </button>
          <button
            type="button"
            className="survey__mode-btn"
            aria-pressed={mode === 'search'}
            onClick={() => setMode('search')}
          >
            Recherche
          </button>
        </div>
        {mode === 'guided' && (
          <span className="survey__progress">{Math.min(cursor + 1, queue.length)} / {queue.length}</span>
        )}
      </header>

      {mode === 'search' && (
        <div className="survey__search">
          <input
            type="search"
            className="survey__search-input"
            value={search}
            placeholder="Nom de l'objet"
            aria-label="Nom de l'objet"
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.length >= SEARCH_MIN_LENGTH && (
            <ul className="survey__search-results">
              {[...catalog!.itemsById.values()]
                .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
                .slice(0, SEARCH_RESULT_LIMIT)
                .map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      className="survey__search-result"
                      onClick={() => { setManualId(i.id); setSearch('') }}
                    >
                      <img src={i.imgUrl} alt="" width={24} height={24} loading="lazy" />
                      <span className="survey__search-result-name">{i.name}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {item ? (
        <>
          <div className="survey__item">
            <img src={item.imgUrl} alt="" width={64} height={64} />
            <h1>{item.name}</h1>
            <p className="survey__previous">
              <FreshnessDot level={freshnessOf(existing, now, settings.freshness)} />
              {existing ? (
                <span className="survey__previous-value">
                  {formatKamas(unitPrice(existing))} l'unité · {describeAge(now - existing.observedAt)}
                </span>
              ) : (
                <span className="survey__previous-empty">Jamais relevé</span>
              )}
            </p>
          </div>

          <LotSelector value={lot} onChange={setLot} />

          <output className="survey__draft">{draft === '' ? '—' : formatKamas(Number(draft))}</output>

          <NumericKeypad onKey={(key) => setDraft((d) => applyKey(d, key))} />
        </>
      ) : currentId !== null && (
        <p className="survey__unknown">
          Objet inconnu du catalogue (identifiant {currentId}). Passe au suivant.
        </p>
      )}

      {/*
        Bretelles du correctif d'orphelin : « Passer » vit hors du bloc `item`,
        si bien qu'aucune entrée de file ne peut plus être un cul-de-sac, quelle
        qu'en soit la cause. « Valider » reste conditionné à l'objet — valider
        un identifiant sans objet enregistrerait un prix inexploitable.
      */}
      {currentId !== null && (
        <div className="survey__actions">
          <button type="button" className="survey__skip" onClick={advance}>Passer</button>
          {item && (
            <button type="button" className="survey__submit" disabled={draft === ''} onClick={() => void submit()}>
              Valider
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function describeAge(ms: number): string {
  const hours = ms / HOUR_MS
  if (hours < 1) return "il y a moins d'une heure"
  if (hours < 24) return `il y a ${Math.floor(hours)} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

/**
 * Accueil quand la file n'a jamais rien contenu — le premier écran qu'un
 * nouveau joueur voit s'il ouvre l'onglet Prix avant les Réglages. Il dit ce
 * qui manque et où le faire, jamais un bilan d'une session qui n'a pas eu lieu.
 */
function SurveyWelcome({ hasJobs, onSearch }: { hasJobs: boolean; onSearch: () => void }) {
  return (
    <section className="survey-welcome">
      <h1>Rien à relever pour l'instant</h1>
      {hasJobs ? (
        <p>
          Aucune recette n'est à la portée de tes niveaux de métier actuels.
          Monte-les, ou relève un prix à la main par la recherche.
        </p>
      ) : (
        <p>
          Déclare tes niveaux de métier dans les Réglages : c'est ce qui
          détermine les crafts que tu peux faire, donc les prix qui valent la
          peine d'être relevés.
        </p>
      )}
      <button type="button" className="survey-welcome__search" onClick={onSearch}>
        Recherche libre
      </button>
    </section>
  )
}

/**
 * Écran de fin de session. Il ne se contente pas de compter les saisies : il
 * relie l'effort au gain en nommant les crafts devenus rentables. C'est ce qui
 * donne au joueur une raison de recommencer demain.
 */
function SurveyRecap({ recorded, profitableAtStart, onRestart, onSearch }: {
  recorded: number
  profitableAtStart: Set<number>
  onRestart: () => void
  onSearch: () => void
}) {
  const { catalog, priceBook, settings } = useAppState()
  const { ranked } = rankCrafts(catalog!, priceBook, settings.jobLevels, Date.now(), settings.freshness)
  const profitable = ranked.filter((c) => c.margin!.net > 0)
  const unlocked = profitable.filter((c) => !profitableAtStart.has(c.resultItemId))

  return (
    <section className="survey-done">
      <h1>{recorded} prix relevé{recorded > 1 ? 's' : ''}</h1>
      <p>{ranked.length} craft{ranked.length > 1 ? 's' : ''} calculable{ranked.length > 1 ? 's' : ''}.</p>

      {unlocked.length > 0 ? (
        <>
          <h2>
            {unlocked.length} craft{unlocked.length > 1 ? 's sont devenus rentables' : ' est devenu rentable'}
          </h2>
          <ul className="survey-done__unlocked">
            {unlocked.slice(0, 5).map((craft) => (
              <li key={craft.resultItemId}>
                <span className="survey-done__unlocked-name">
                  {catalog!.itemsById.get(craft.resultItemId)?.name ?? `Objet ${craft.resultItemId}`}
                </span>
                <KamasAmount value={craft.margin!.net} signed />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="survey-done__empty">Aucun nouveau craft rentable cette fois.</p>
      )}

      <div className="survey-done__actions">
        <button type="button" className="survey-done__restart" onClick={onRestart}>Nouvelle session</button>
        <button type="button" className="survey-done__search" onClick={onSearch}>Recherche libre</button>
      </div>
    </section>
  )
}
