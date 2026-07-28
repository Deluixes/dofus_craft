import { useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { craftCost } from '../../domain/craftCost'
import { craftMargin } from '../../domain/margin'
import { unitPrice } from '../../domain/price'
import { freshnessOf } from '../../domain/freshness'
import { averageJets, breakingValue } from '../../domain/breaking'
import { createSale } from '../../domain/sale'
import { RUNES, STAT_WEIGHTS, type RuneRef } from '../../catalog/statWeights'
import { KamasAmount, formatKamas } from '../components/KamasAmount'
import { FreshnessDot } from '../components/FreshnessDot'
import { LotSelector } from '../components/LotSelector'
import { describeSaleSize } from '../components/lotLabel'
import type { LotSize } from '../../domain/types'

/**
 * Détail d'un craft : coût ingrédient par ingrédient, marge, et comparaison
 * avec la valeur de brisage.
 *
 * Le prix de vente saisi ici est une simulation locale (état React, jamais
 * écrit dans `priceBook`) : elle laisse explorer un scénario sans corrompre
 * le relevé réel que consomme le classement de l'écran Crafts.
 */
export function CraftDetailScreen({ itemId, onClose, onEditPrice }: {
  itemId: number
  onClose: () => void
  onEditPrice: (itemId: number) => void
}) {
  const { catalog, priceBook, settings, addSale } = useAppState()
  const item = catalog!.itemsById.get(itemId)
  const recipe = catalog!.recipeByResultId.get(itemId)

  const [simulated, setSimulated] = useState<number | null>(null)
  const [saleLot, setSaleLot] = useState<LotSize>(1)
  const [saleQty, setSaleQty] = useState(1)

  const now = Date.now()
  const cost = useMemo(() => (recipe ? craftCost(recipe, priceBook) : null), [recipe, priceBook])
  const recordedSale = priceBook.get(itemId)
  const effectiveSalePrice = simulated ?? (recordedSale ? unitPrice(recordedSale) : null)

  const totalCost = cost?.total ?? null
  const margin = totalCost !== null && effectiveSalePrice !== null
    ? craftMargin(totalCost, effectiveSalePrice)
    : null

  const resolvedRunes = useMemo(() => resolveRunes(settings.runeItemIds), [settings.runeItemIds])

  const breaking = useMemo(
    () => (item ? breakingValue(averageJets(item.stats), STAT_WEIGHTS, resolvedRunes, priceBook) : null),
    [item, priceBook, resolvedRunes],
  )

  /**
   * Vrai si au moins une statistique de l'objet a une rune connue du domaine
   * (une entrée dans RUNES) mais dont l'identifiant catalogue n'a pas encore
   * été renseigné dans les réglages (`runeItemId` toujours à `0`, valeur
   * témoin posée par la tâche 12 et non résolue avant la tâche 17).
   *
   * Sans cette distinction, `breakingValue` ignore silencieusement ces
   * statistiques (comportement voulu et fixé par ses tests — un objet
   * n'ayant *aucune* rune correspondante n'a réellement rien à briser) et le
   * total retombe à 0, indiscernable pour le joueur d'un vrai « ça ne
   * rapporte rien ». Une rune relevée mais non tarifée (`runeItemId` connu,
   * prix manquant) est un troisième état, déjà géré correctement par
   * `total: null` + `missingRuneItemIds` — cette variable ne doit pas le
   * recouvrir.
   */
  const runesUnconfigured = useMemo(() => {
    if (!item) return false
    const unconfiguredStatNames = new Set(
      resolvedRunes.filter((r) => r.runeItemId === 0).map((r) => r.statName),
    )
    return item.stats.some((s) => unconfiguredStatNames.has(s.name))
  }, [item, resolvedRunes])

  if (!item || !recipe || !cost) {
    return <p className="detail__empty">Objet introuvable.</p>
  }

  return (
    <section className="detail">
      <header className="detail__header">
        <button type="button" className="detail__back" onClick={onClose} aria-label="Fermer">
          ←
        </button>
        <img src={item.imgUrl} alt="" width={48} height={48} />
        <h1>{item.name}</h1>
      </header>

      <ul className="detail__ingredients">
        {cost.lines.map((line) => {
          const ing = catalog!.itemsById.get(line.itemId)
          return (
            <li key={line.itemId}>
              <button type="button" className="detail__line" onClick={() => onEditPrice(line.itemId)}>
                <img src={ing?.imgUrl} alt="" width={28} height={28} loading="lazy" />
                <span className="detail__line-name">{ing?.name ?? `Objet ${line.itemId}`}</span>
                <span className="detail__line-amounts">
                  <span className="detail__line-qty">
                    {line.quantity} × {formatKamas(line.unitPrice)}
                  </span>
                  <KamasAmount value={line.subtotal} />
                </span>
                <FreshnessDot level={freshnessOf(priceBook.get(line.itemId), now, settings.freshness)} />
              </button>
            </li>
          )
        })}
      </ul>

      <dl className="detail__totals">
        <dt>Coût de craft</dt>
        <dd><KamasAmount value={cost.total} /></dd>

        <dt>Prix de vente</dt>
        <dd>
          <input
            type="number"
            inputMode="numeric"
            value={effectiveSalePrice ?? ''}
            placeholder="à relever"
            aria-label="Prix de vente simulé"
            onChange={(e) => setSimulated(e.target.value === '' ? null : Number(e.target.value))}
          />
          {simulated !== null && <span className="detail__simulated">simulation, non enregistrée</span>}
        </dd>

        <dt>Taxe 2 %</dt>
        <dd><KamasAmount value={margin?.tax ?? null} /></dd>

        <dt>Marge nette</dt>
        <dd>
          <KamasAmount value={margin?.net ?? null} signed />
          {margin && <span className="detail__pct">({(margin.pct * 100).toFixed(0)} %)</span>}
        </dd>
      </dl>

      <section className="detail__breaking">
        <h2>Vendre ou briser</h2>
        {runesUnconfigured ? (
          <p className="detail__breaking-unconfigured">
            Runes non associées — renseigne-les dans les Réglages pour estimer le brisage.
          </p>
        ) : (
          <>
            <p>
              Vendre <KamasAmount value={effectiveSalePrice} /> · Briser ≈ <KamasAmount value={breaking?.total ?? null} />
            </p>
            <p className="detail__estimate">
              Estimation. Le taux réel dépend de ta puissance de brisage et du focus.
            </p>
          </>
        )}
      </section>

      <section className="detail__list-sale">
        <h2>J'ai crafté et mis en vente</h2>
        <LotSelector value={saleLot} onChange={setSaleLot} />
        {/*
          `saleQty` compte des LOTS, pas des unités (voir `unitsSold` dans
          domain/sale.ts). Le libellé le dit, et le récapitulatif ci-dessous
          affiche le total d'unités : sans lui, « 5 » à côté d'un sélecteur
          ×100 se lit dans les deux sens, et l'écart est d'un facteur 100 sur
          le profit annoncé.
        */}
        <label className="detail__sale-label" htmlFor="detail-lot-count">Nombre de lots</label>
        <input
          id="detail-lot-count"
          type="number"
          inputMode="numeric"
          min={1}
          value={saleQty}
          onChange={(e) => setSaleQty(Math.max(1, Number(e.target.value)))}
          aria-label="Nombre de lots"
        />
        <p className="detail__sale-units">{describeSaleSize(saleQty, saleLot)}</p>
        <button
          type="button"
          disabled={cost.total === null || effectiveSalePrice === null}
          onClick={() => {
            void addSale(createSale({
              itemId,
              quantity: saleQty,
              lotSize: saleLot,
              unitPrice: effectiveSalePrice!,
              frozenCraftCost: cost.total!,
            }, Date.now()))
          }}
        >
          Enregistrer la vente
        </button>
      </section>
    </section>
  )
}

/** Applique les identifiants de runes renseignés dans les réglages. */
function resolveRunes(runeItemIds: Record<string, number>): RuneRef[] {
  return RUNES.map((r) => ({ ...r, runeItemId: runeItemIds[r.statName] ?? r.runeItemId }))
}
