import { useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { KamasAmount, formatKamas } from '../components/KamasAmount'
import { CumulativeCurve } from '../graphs/CumulativeCurve'
import { PeriodBars } from '../graphs/PeriodBars'
import {
  buildEvents,
  cumulativeCurve,
  periodSummaries,
  dormantTrades,
  itemRanking,
  type Granularity,
} from '../../domain/ledger'
import { portfolioSummary } from '../../domain/tradeStats'
import { toDateInput } from '../clock'

/**
 * Le bilan : où en est ce commerce, et comment il évolue.
 *
 * C'est ici que vit le flux de trésorerie net, et non sur l'écran Négoce : il
 * plonge mécaniquement à chaque réapprovisionnement, donc il renseigne sur
 * l'endroit où l'on se trouve dans son cycle d'achat, pas sur sa performance.
 * En tête d'écran, il découragerait à tort.
 */
export function LedgerScreen() {
  const { tradeList, catalog } = useAppState()
  const [granularity, setGranularity] = useState<Granularity>('month')

  const now = Date.now()
  const events = useMemo(() => buildEvents(tradeList), [tradeList])
  const summary = useMemo(() => portfolioSummary(tradeList, now), [tradeList, now])
  const curve = useMemo(() => cumulativeCurve(events), [events])
  const periods = useMemo(() => periodSummaries(events, granularity), [events, granularity])
  const dormant = useMemo(() => dormantTrades(tradeList, now), [tradeList, now])
  const ranking = useMemo(() => itemRanking(tradeList), [tradeList])

  if (tradeList.length === 0) {
    return (
      <section className="ledger">
        <p className="sales__empty">
          Le bilan s'écrira tout seul dès la première opération enregistrée.
        </p>
      </section>
    )
  }

  return (
    <section className="ledger">
      <dl className="ledger__figures">
        <dt>Kamas investis</dt>
        <dd><KamasAmount value={summary.invested} /></dd>
        <dt>Kamas récupérés</dt>
        <dd><KamasAmount value={summary.recovered} /></dd>
        <dt>Taxes payées</dt>
        <dd><KamasAmount value={-summary.taxesPaid} /></dd>
        <dt>Bénéfice réalisé</dt>
        <dd><KamasAmount value={summary.realizedProfit} signed /></dd>
        <dt>Trésorerie nette</dt>
        <dd><KamasAmount value={summary.netCashFlow} signed /></dd>
        <dt>Rentabilité</dt>
        <dd>{summary.roi === null ? '—' : `${(summary.roi * 100).toFixed(1)} %`}</dd>
      </dl>

      <h2 className="ledger__heading">Bénéfice cumulé</h2>
      <CumulativeCurve points={curve} />

      <h2 className="ledger__heading">Par période</h2>
      <div className="ledger__granularity" role="group" aria-label="Granularité">
        {(['week', 'month'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={granularity === value}
            onClick={() => setGranularity(value)}
          >
            {value === 'week' ? 'Semaine' : 'Mois'}
          </button>
        ))}
      </div>
      <PeriodBars periods={periods} />

      <h2 className="ledger__heading">
        Ce qui dort · <KamasAmount value={summary.committed} />
      </h2>
      {dormant.length === 0 ? (
        <p className="ledger__empty">Rien en stock : tout est parti.</p>
      ) : (
        <ul className="ledger__dormant">
          {dormant.slice(0, 10).map(({ trade, stats }) => (
            <li key={trade.id}>
              <span className="ledger__dormant-name">
                {catalog?.itemsById.get(trade.itemId)?.name ?? `Objet ${trade.itemId}`}
              </span>
              <span className="ledger__dormant-age">
                {stats.remainingQuantity} depuis {stats.daysHeld} j
                {' · '}
                <span className="ledger__dormant-date">{toDateInput(trade.acquiredAt)}</span>
              </span>
              <KamasAmount value={stats.committed} />
            </li>
          ))}
        </ul>
      )}

      <h2 className="ledger__heading">Ce qui rapporte</h2>
      {ranking.length === 0 ? (
        <p className="ledger__empty">
          Aucune vente conclue : rien à classer. Les objets encore en stock n'y
          figurent pas, ils n'afficheraient que leurs taxes.
        </p>
      ) : (
        <ol className="ledger__ranking">
          {ranking.slice(0, 10).map((stat) => (
            <li key={stat.itemId}>
              <span className="ledger__ranking-name">
                {catalog?.itemsById.get(stat.itemId)?.name ?? `Objet ${stat.itemId}`}
              </span>
              <span className="ledger__ranking-meta">
                {stat.soldQuantity} vendus
                {stat.marginRate !== null && ` · ${(stat.marginRate * 100).toFixed(0)} %`}
              </span>
              <KamasAmount value={stat.realizedProfit} signed />
            </li>
          ))}
        </ol>
      )}

      <p className="ledger__note">
        Le bénéfice réalisé ne compte que les unités effectivement vendues. Le coût
        de ce qui reste en stock n'est pas une perte : il figure dans « ce qui dort ».
        Les taxes, elles, sont perdues dès leur paiement — c'est pourquoi une ligne
        remise en vente sans être vendue affiche un bénéfice négatif.
      </p>
      <p className="ledger__note">
        Contrôle : bénéfice réalisé {formatKamas(summary.realizedProfit, { signed: true })} moins
        capital immobilisé {formatKamas(summary.committed)} égale la trésorerie nette,{' '}
        {formatKamas(summary.netCashFlow, { signed: true })}.
      </p>
    </section>
  )
}
