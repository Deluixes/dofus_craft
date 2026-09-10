import { useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { KamasAmount } from '../components/KamasAmount'
import { portfolioSummary, tradeStats } from '../../domain/tradeStats'
import { remainingQuantity, type Trade } from '../../domain/trade'
import { STATUS_GROUPS, STATUS_LABELS } from './tradeLabels'
import { TradeForm } from './TradeForm'
import { TradeDetail } from './TradeDetail'

/**
 * Le registre de négoce : tout ce qui a été acheté ou crafté, ce qui est en
 * vente, ce qui dort, ce qui est parti.
 *
 * Le chiffre de tête est le **bénéfice réalisé**, seul indicateur qui réponde à
 * « est-ce que ce commerce gagne de l'argent ? » sans être pollué par le
 * calendrier des achats. Le flux de trésorerie, plus juste au sens comptable,
 * serait trompeur ici : il plonge mécaniquement dès qu'on réapprovisionne, et
 * mesure donc où l'on en est dans son cycle d'achat, pas sa performance. Il a
 * sa place sur l'écran Bilan.
 */
export function TradesScreen() {
  const { tradeList } = useAppState()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const now = Date.now()
  const summary = useMemo(() => portfolioSummary(tradeList, now), [tradeList, now])
  const open = tradeList.find((t) => t.id === openId) ?? null

  if (adding) return <TradeForm onClose={() => setAdding(false)} />
  if (open !== null) return <TradeDetail trade={open} onClose={() => setOpenId(null)} />

  return (
    <section className="sales">
      <dl className="sales__summary">
        <dt>Bénéfice réalisé</dt>
        <dd><KamasAmount value={summary.realizedProfit} signed /></dd>
        <dt>Capital immobilisé</dt>
        <dd><KamasAmount value={summary.committed} /></dd>
        <dt>Bénéfice latent</dt>
        <dd><KamasAmount value={summary.unrealizedProfit} signed /></dd>
      </dl>

      {tradeList.length === 0 && (
        <p className="sales__empty">
          Aucune opération. Note un achat ou un craft pour commencer à suivre tes kamas.
        </p>
      )}

      {STATUS_GROUPS.map((group) => {
        const rows = tradeList.filter((t) => group.statuses.includes(tradeStats(t, now).status))
        if (rows.length === 0) return null
        return (
          <div key={group.title}>
            <h2 className="sales__heading">{group.title}</h2>
            <ul className="sales__list">
              {rows.map((trade) => (
                <TradeRow key={trade.id} trade={trade} now={now} onOpen={setOpenId} />
              ))}
            </ul>
          </div>
        )
      })}

      <button
        type="button"
        className="sales__add"
        onClick={() => setAdding(true)}
        aria-label="Ajouter une opération"
      >
        +
      </button>
    </section>
  )
}

function TradeRow({
  trade,
  now,
  onOpen,
}: {
  trade: Trade
  now: number
  onOpen: (id: number) => void
}) {
  const { catalog, settings } = useAppState()
  const item = catalog?.itemsById.get(trade.itemId)
  const stats = tradeStats(trade, now)
  const remaining = remainingQuantity(trade)

  // Le seuil de vieillissement du carnet de prix sert aussi de repère ici : un
  // stock plus vieux que ça mérite qu'on s'y intéresse.
  const dormant = stats.daysHeld !== null && stats.daysHeld > settings.freshness.staleHours / 24

  return (
    <li className="sale-card" data-urgent={dormant}>
      <button type="button" className="sale-card__open" onClick={() => onOpen(trade.id!)}>
        <div className="sale-card__main">
          <img src={item?.imgUrl} alt="" width={36} height={36} loading="lazy" />
          <span className="sale-card__name">{item?.name ?? `Objet ${trade.itemId}`}</span>
          <span className="sale-card__expiry" data-urgent={dormant}>
            {stats.daysHeld === null ? STATUS_LABELS[stats.status] : `${stats.daysHeld} j`}
          </span>
        </div>
        <div className="sale-card__details">
          <span className="sale-card__qty">
            {item?.type}
            {remaining > 0 ? ` · ${remaining}/${trade.quantity} restants` : ` · ${trade.quantity} vendus`}
          </span>
          <KamasAmount value={stats.realizedProfit} signed />
        </div>
      </button>
    </li>
  )
}
