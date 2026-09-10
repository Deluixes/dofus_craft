import { useState } from 'react'
import { useAppState } from '../AppState'
import { KamasAmount } from '../components/KamasAmount'
import { listingTax } from '../../domain/margin'
import { lastAskPrice, remainingQuantity, type Trade } from '../../domain/trade'
import { tradeStats } from '../../domain/tradeStats'
import { STATUS_LABELS } from './tradeLabels'
import { startOfToday, toDateInput, fromDateInput } from '../clock'

/**
 * Détail d'une opération : ce qu'elle a coûté, ce qu'elle a rapporté, et
 * l'historique complet de ses passages en HDV.
 *
 * L'historique des mises en vente est affiché ligne par ligne, taxe comprise :
 * c'est le seul moyen de comprendre pourquoi une opération invendue affiche un
 * bénéfice négatif. Chaque mouvement est supprimable, sinon une remise en vente
 * saisie par erreur coûterait une taxe fantôme indélébile.
 */
export function TradeDetail({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const { catalog, listTrade, sellTrade, withdrawTrade, dropMovement, removeTrade } = useAppState()
  const item = catalog?.itemsById.get(trade.itemId)
  const stats = tradeStats(trade, Date.now())
  const remaining = remainingQuantity(trade)

  const [action, setAction] = useState<'list' | 'sell' | null>(null)
  const [price, setPrice] = useState(String(lastAskPrice(trade) ?? ''))
  const [quantity, setQuantity] = useState(remaining)
  const [at, setAt] = useState(startOfToday())
  const [confirmDelete, setConfirmDelete] = useState(false)

  function openAction(next: 'list' | 'sell') {
    // Pré-remplir au dernier prix et à la quantité restante : c'est le cas de
    // très loin le plus fréquent, et ça évite une saisie de plus au pouce.
    setPrice(String(lastAskPrice(trade) ?? ''))
    setQuantity(remaining)
    setAt(startOfToday())
    setAction(next)
  }

  function submit() {
    const value = Number(price) || 0
    if (value <= 0 || quantity <= 0 || trade.id === undefined) return
    if (action === 'list') void listTrade(trade.id, value, quantity, at)
    else void sellTrade(trade.id, value, quantity, at)
    setAction(null)
  }

  return (
    <section className="trade-detail">
      <header className="trade-detail__head">
        <img src={item?.imgUrl} alt="" width={40} height={40} loading="lazy" />
        <div>
          <h1>{item?.name ?? `Objet ${trade.itemId}`}</h1>
          <p className="trade-detail__meta">
            {item?.type} · {trade.origin === 'purchase' ? 'acheté' : 'crafté'} ·{' '}
            {STATUS_LABELS[stats.status]}
          </p>
        </div>
        <button type="button" className="trade-detail__close" onClick={onClose}>Fermer</button>
      </header>

      <dl className="trade-detail__figures">
        <dt>Investi</dt>
        <dd><KamasAmount value={stats.investment} /></dd>
        <dt>Encaissé</dt>
        <dd><KamasAmount value={stats.revenue} /></dd>
        <dt>Taxes payées</dt>
        <dd><KamasAmount value={-stats.taxesPaid} /></dd>
        <dt>Bénéfice réalisé</dt>
        <dd><KamasAmount value={stats.realizedProfit} signed /></dd>
        {remaining > 0 && (
          <>
            <dt>Reste {remaining} sur {trade.quantity}</dt>
            <dd><KamasAmount value={stats.committed} /> immobilisés</dd>
          </>
        )}
      </dl>

      {action === null ? (
        <div className="trade-detail__actions">
          {remaining > 0 && (
            <>
              <button type="button" onClick={() => openAction('list')}>
                {trade.listings.length === 0 ? 'Mettre en vente' : 'Remettre en vente'}
              </button>
              <button type="button" onClick={() => openAction('sell')}>Vendu</button>
              <button
                type="button"
                onClick={() => trade.id !== undefined && void withdrawTrade(trade.id, startOfToday())}
              >
                Retiré du HDV
              </button>
            </>
          )}
        </div>
      ) : (
        <form className="trade-detail__form" onSubmit={(e) => { e.preventDefault(); submit() }}>
          <h2>{action === 'list' ? 'Mise en vente' : 'Vente'}</h2>
          <label>
            <span>Prix unitaire</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            <span>Quantité (reste {remaining})</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={remaining}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={toDateInput(at)}
              onChange={(e) => setAt(fromDateInput(e.target.value))}
            />
          </label>
          {action === 'list' && Number(price) > 0 && (
            <p className="trade-detail__tax-warning">
              Taxe prélevée immédiatement :{' '}
              <KamasAmount value={-listingTax(Number(price), quantity)} />, perdue même si
              l'objet ne se vend pas.
            </p>
          )}
          <div className="trade-detail__form-actions">
            <button type="submit">Confirmer</button>
            <button type="button" onClick={() => setAction(null)}>Annuler</button>
          </div>
        </form>
      )}

      <h2 className="trade-detail__heading">Mises en vente</h2>
      {trade.listings.length === 0 ? (
        <p className="trade-detail__empty">Jamais proposé en HDV.</p>
      ) : (
        <ul className="trade-detail__movements">
          {[...trade.listings].sort((a, b) => a.at - b.at).map((m) => (
            <li key={m.id}>
              <span>{toDateInput(m.at)}</span>
              <span>{m.quantity} × <KamasAmount value={m.unitPrice} /></span>
              <span className="trade-detail__movement-tax">
                taxe <KamasAmount value={-listingTax(m.unitPrice, m.quantity)} />
              </span>
              <button
                type="button"
                aria-label="Supprimer cette mise en vente"
                onClick={() => trade.id !== undefined && void dropMovement(trade.id, m.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="trade-detail__heading">Ventes</h2>
      {trade.sales.length === 0 ? (
        <p className="trade-detail__empty">Rien de vendu pour l'instant.</p>
      ) : (
        <ul className="trade-detail__movements">
          {[...trade.sales].sort((a, b) => a.at - b.at).map((m) => (
            <li key={m.id}>
              <span>{toDateInput(m.at)}</span>
              <span>{m.quantity} × <KamasAmount value={m.unitPrice} /></span>
              <span><KamasAmount value={m.unitPrice * m.quantity} /></span>
              <button
                type="button"
                aria-label="Supprimer cette vente"
                onClick={() => trade.id !== undefined && void dropMovement(trade.id, m.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="trade-detail__danger">
        {confirmDelete ? (
          <>
            <p>Supprimer définitivement cette opération et son historique ?</p>
            <button
              type="button"
              className="trade-detail__delete"
              onClick={() => {
                if (trade.id !== undefined) void removeTrade(trade.id)
                onClose()
              }}
            >
              Oui, supprimer
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>Annuler</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}>
            Supprimer cette opération
          </button>
        )}
      </footer>
    </section>
  )
}
