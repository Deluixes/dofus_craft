import { useAppState } from '../AppState'
import { committedKamas, hoursUntilExpiry, realizedProfit, unitsSold, type Sale } from '../../domain/sale'
import { saleTax } from '../../domain/margin'
import { KamasAmount } from '../components/KamasAmount'
import { describeSaleSize } from '../components/lotLabel'

/** Seuil sous lequel une vente en cours devient urgente à surveiller. */
const ALERT_HOURS = 48

/**
 * Écran Ventes : ce qui est encore à l'HDV et ce qui a été conclu.
 *
 * Une mise en vente dure 14 jours puis revient en banque invendue — la taxe
 * de 2 % payée à la mise en vente n'est pas remboursée, un retour est donc
 * une petite perte réelle, pas un non-événement. Le profit réalisé ne compte
 * donc que les ventes conclues (`status === 'sold'`), jamais les retours à
 * zéro ni une reconstitution aux prix du jour : `realizedProfit` s'appuie sur
 * `frozenCraftCost`, le coût figé à la mise en vente.
 */
export function SalesScreen() {
  const { saleList, closeSale } = useAppState()
  const now = Date.now()

  const listed = saleList.filter((s) => s.status === 'listed')
  const closed = saleList
    .filter((s) => s.status !== 'listed')
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
  const realized = closed
    .filter((s) => s.status === 'sold')
    .reduce((sum, s) => sum + realizedProfit(s), 0)

  return (
    <section className="sales">
      <dl className="sales__summary">
        <dt>Engagé en HDV</dt>
        <dd><KamasAmount value={committedKamas(saleList)} /></dd>
        <dt>Profit réalisé</dt>
        <dd><KamasAmount value={realized} signed /></dd>
      </dl>

      <h2 className="sales__heading">En vente</h2>
      {listed.length === 0 ? (
        <p className="sales__empty">Aucune vente en cours.</p>
      ) : (
        <ul className="sales__list">
          {listed.map((sale) => (
            <SaleListItem key={sale.id} sale={sale} now={now} onClose={closeSale} />
          ))}
        </ul>
      )}

      <h2 className="sales__heading">Historique</h2>
      {closed.length === 0 ? (
        <p className="sales__empty">Aucune vente conclue.</p>
      ) : (
        <ul className="sales__history">
          {closed.map((sale) => (
            <HistoryItem key={sale.id} sale={sale} />
          ))}
        </ul>
      )}
    </section>
  )
}

function SaleListItem({ sale, now, onClose }: {
  sale: Sale
  now: number
  onClose: (id: number, status: 'sold' | 'returned') => Promise<void>
}) {
  const { catalog } = useAppState()
  const item = catalog!.itemsById.get(sale.itemId)
  const remaining = hoursUntilExpiry(sale, now)
  const urgent = remaining < ALERT_HOURS

  return (
    <li className="sale-card" data-urgent={urgent}>
      <div className="sale-card__main">
        <img src={item?.imgUrl} alt="" width={36} height={36} loading="lazy" />
        <span className="sale-card__name">{item?.name ?? `Objet ${sale.itemId}`}</span>
        <span className="sale-card__expiry" data-urgent={urgent}>
          {remaining === 0
            ? 'Expirée'
            : urgent
              ? `Expire dans ${Math.floor(remaining)} h`
              : `${Math.floor(remaining / 24)} j restants`}
        </span>
      </div>
      <div className="sale-card__details">
        <span className="sale-card__qty">{describeSaleSize(sale.quantity, sale.lotSize)}</span>
        <KamasAmount value={sale.unitPrice} />
      </div>
      <div className="sale-card__actions">
        <button type="button" className="sale-card__sold" onClick={() => void onClose(sale.id!, 'sold')}>
          Vendu
        </button>
        <button type="button" className="sale-card__returned" onClick={() => void onClose(sale.id!, 'returned')}>
          Retourné
        </button>
      </div>
    </li>
  )
}

function HistoryItem({ sale }: { sale: Sale }) {
  const { catalog } = useAppState()
  const item = catalog!.itemsById.get(sale.itemId)

  return (
    <li className="sales__history-row">
      <img src={item?.imgUrl} alt="" width={28} height={28} loading="lazy" />
      <span className="sales__history-name">{item?.name ?? `Objet ${sale.itemId}`}</span>
      <span className="sales__history-qty">{describeSaleSize(sale.quantity, sale.lotSize)}</span>
      {sale.status === 'sold' ? (
        <KamasAmount value={realizedProfit(sale)} signed />
      ) : (
        <span className="sales__history-returned">
          retourné en banque · taxe perdue{' '}
          {/* La taxe est payée à l'unité, sur toutes les unités engagées :
              même correction de facteur que `realizedProfit`. */}
          <KamasAmount value={-saleTax(sale.unitPrice) * unitsSold(sale)} />
        </span>
      )}
    </li>
  )
}
