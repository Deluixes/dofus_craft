import { useDeferredValue, useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { indexItems, searchItems, MIN_QUERY_LENGTH } from '../../domain/itemSearch'
import type { Item } from '../../catalog/types'

/**
 * Choix d'un objet du catalogue par saisie assistée.
 *
 * Pas de `<datalist>` : son rendu est incohérent et non stylable sur
 * Android/Chrome, or c'est là que l'application est utilisée. La liste est donc
 * une vraie `listbox` de boutons pleine largeur, à la hauteur de cible tactile
 * du thème.
 *
 * `useDeferredValue` plutôt qu'un anti-rebond au `setTimeout` : la frappe reste
 * prioritaire sur le rendu de la liste, sans délai fixe à régler au jugé.
 */
export function ItemPicker({
  value,
  onChange,
}: {
  value: Item | null
  onChange: (item: Item | null) => void
}) {
  const { catalog } = useAppState()
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)

  // Les clés de recherche sont calculées une seule fois pour tout le catalogue.
  const index = useMemo(
    () => (catalog ? indexItems(catalog.itemsById.values()) : []),
    [catalog],
  )
  const results = useMemo(() => searchItems(index, deferred), [index, deferred])

  if (value !== null) {
    return (
      <div className="item-picker__chosen">
        <img src={value.imgUrl} alt="" width={32} height={32} loading="lazy" />
        <span className="item-picker__name">{value.name}</span>
        <span className="item-picker__meta">
          {value.type}
          {value.level > 0 ? ` · niv. ${value.level}` : ''}
        </span>
        <button
          type="button"
          className="item-picker__clear"
          onClick={() => {
            setQuery('')
            onChange(null)
          }}
        >
          Changer
        </button>
      </div>
    )
  }

  return (
    <div className="item-picker">
      <input
        type="search"
        className="item-picker__input"
        placeholder="Nom de l'objet"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        aria-label="Rechercher un objet"
      />
      {query.trim().length >= MIN_QUERY_LENGTH && results.length === 0 && (
        <p className="item-picker__empty">
          Aucun objet de ce nom. Le catalogue date de 2019 : les objets parus
          depuis en sont absents.
        </p>
      )}
      <ul className="item-picker__results" role="listbox">
        {results.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              role="option"
              aria-selected="false"
              className="item-picker__option"
              onClick={() => onChange(item)}
            >
              <img src={item.imgUrl} alt="" width={28} height={28} loading="lazy" />
              <span className="item-picker__name">{item.name}</span>
              <span className="item-picker__meta">
                {item.type}
                {item.level > 0 ? ` · niv. ${item.level}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
