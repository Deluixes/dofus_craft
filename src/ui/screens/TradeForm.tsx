import { useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { ItemPicker } from '../components/ItemPicker'
import { KamasAmount, formatKamas } from '../components/KamasAmount'
import { unitPrice } from '../../domain/price'
import { listingTax } from '../../domain/margin'
import { startOfToday, toDateInput, fromDateInput } from '../clock'
import type { Item } from '../../catalog/types'
import type { TradeOrigin } from '../../domain/trade'

/**
 * Saisie d'une opération de négoce.
 *
 * Le coût de revient est TOUJOURS un champ modifiable à la main. Quand l'objet
 * a une recette, les ingrédients sont affichés avec leur prix unitaire relevé,
 * et leur somme remplit le champ — mais elle ne le verrouille pas : les prix ne
 * sont pas connaissables par l'application, seulement par le joueur, et un prix
 * manquant ne doit jamais empêcher d'enregistrer une opération.
 */
export function TradeForm({ onClose }: { onClose: () => void }) {
  const { catalog, priceBook, recordPrice, addTrade } = useAppState()

  const [item, setItem] = useState<Item | null>(null)
  const [origin, setOrigin] = useState<TradeOrigin>('purchase')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState('')
  const [acquiredAt, setAcquiredAt] = useState(startOfToday())
  const [askPrice, setAskPrice] = useState('')
  const [listNow, setListNow] = useState(true)

  const recipe = item ? catalog?.recipeByResultId.get(item.id) : undefined

  /** Somme des prix relevés des ingrédients, `null` si l'un d'eux manque. */
  const recipeCost = useMemo(() => {
    if (!recipe) return null
    let total = 0
    for (const ing of recipe.ingredients) {
      const entry = priceBook.get(ing.itemId)
      if (!entry) return null
      total += unitPrice(entry) * ing.quantity
    }
    return Math.round(total)
  }, [recipe, priceBook])

  const cost = Number(unitCost) || 0
  const ask = Number(askPrice) || 0
  const tax = listNow && ask > 0 ? listingTax(ask, quantity) : 0
  const projected = listNow && ask > 0 ? (ask - cost) * quantity - tax : null

  const canSave = item !== null && quantity > 0 && unitCost !== '' && (!listNow || ask > 0)

  function save() {
    if (item === null) return
    void addTrade(
      { itemId: item.id, origin, quantity, unitCost: cost, acquiredAt },
      listNow ? { unitPrice: ask, quantity } : null,
    )
    onClose()
  }

  return (
    <section className="trade-form">
      <header className="trade-form__head">
        <h1>Nouvelle opération</h1>
        <button type="button" className="trade-form__close" onClick={onClose}>Fermer</button>
      </header>

      <ItemPicker value={item} onChange={setItem} />

      {item !== null && (
        <>
          <fieldset className="trade-form__origin">
            <legend>Provenance</legend>
            {(['purchase', 'craft'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={origin === value}
                onClick={() => setOrigin(value)}
              >
                {value === 'purchase' ? 'Acheté en HDV' : 'Crafté'}
              </button>
            ))}
          </fieldset>

          <label className="trade-form__field">
            <span>Quantité (unités)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </label>

          {origin === 'craft' && recipe && (
            <section className="trade-form__recipe">
              <h2>Ingrédients</h2>
              <p className="trade-form__hint">
                Saisis le prix unitaire relevé en HDV. Il alimente aussi l'écran Prix.
              </p>
              <ul>
                {recipe.ingredients.map((ing) => {
                  const ingredient = catalog?.itemsById.get(ing.itemId)
                  const known = priceBook.get(ing.itemId)
                  return (
                    <li key={ing.itemId}>
                      <span className="trade-form__ing-name">
                        {ingredient?.name ?? `Objet ${ing.itemId}`}
                      </span>
                      <span className="trade-form__ing-qty">×{ing.quantity}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="prix unitaire"
                        defaultValue={known ? Math.round(unitPrice(known)) : ''}
                        aria-label={`Prix unitaire de ${ingredient?.name ?? ing.itemId}`}
                        onBlur={(e) => {
                          const kamas = Number(e.target.value)
                          if (kamas > 0) void recordPrice(ing.itemId, kamas, 1)
                        }}
                      />
                    </li>
                  )
                })}
              </ul>
              <p className="trade-form__recipe-total">
                Coût calculé :{' '}
                {recipeCost === null
                  ? 'incomplet, il manque des prix'
                  : formatKamas(recipeCost)}
                {recipeCost !== null && (
                  <button type="button" onClick={() => setUnitCost(String(recipeCost))}>
                    Reporter
                  </button>
                )}
              </p>
            </section>
          )}

          <label className="trade-form__field">
            <span>{origin === 'purchase' ? "Prix d'achat unitaire" : 'Coût de revient unitaire'}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </label>

          <label className="trade-form__field">
            <span>Date d'acquisition</span>
            <input
              type="date"
              value={toDateInput(acquiredAt)}
              onChange={(e) => setAcquiredAt(fromDateInput(e.target.value))}
            />
          </label>

          <label className="trade-form__check">
            <input
              type="checkbox"
              checked={listNow}
              onChange={(e) => setListNow(e.target.checked)}
            />
            <span>Mettre en vente tout de suite</span>
          </label>

          {listNow && (
            <label className="trade-form__field">
              <span>Prix de vente unitaire demandé</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={askPrice}
                onChange={(e) => setAskPrice(e.target.value)}
              />
            </label>
          )}

          {projected !== null && (
            <dl className="trade-form__preview">
              <dt>Taxe à la mise en vente</dt>
              <dd><KamasAmount value={-tax} /></dd>
              <dt>Bénéfice si tout part à ce prix</dt>
              <dd><KamasAmount value={projected} signed /></dd>
            </dl>
          )}

          <button
            type="button"
            className="trade-form__save"
            disabled={!canSave}
            onClick={save}
          >
            Enregistrer
          </button>
        </>
      )}
    </section>
  )
}
