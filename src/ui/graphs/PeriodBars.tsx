import { useState } from 'react'
import { linearScale, niceTicks, domainWithZero } from './scale'
import { formatKamas } from '../components/KamasAmount'
import type { PeriodSummary } from '../../domain/ledger'

const W = 320
const H = 170
const PAD = { top: 12, right: 10, bottom: 24, left: 10 }
/** Écart de surface entre deux barres voisines, comme entre deux segments empilés. */
const GAP = 2
const RADIUS = 4

/**
 * Bénéfice net par période.
 *
 * Le signe est porté par la POSITION — au-dessus ou en dessous de la ligne de
 * zéro — autant que par la teinte, si bien que le graphique reste lisible sans
 * percevoir les couleurs. Les deux teintes sont celles du thème, verrouillées
 * par `tests/palette.test.ts`.
 *
 * Les extrémités des barres sont arrondies du côté de la donnée et ancrées à
 * la ligne de base : une barre ne flotte jamais.
 */
export function PeriodBars({ periods }: { periods: PeriodSummary[] }) {
  const [hover, setHover] = useState<number | null>(null)

  if (periods.length === 0) {
    return <p className="graph__empty">Aucune période à comparer pour l'instant.</p>
  }

  const values = periods.map((p) => p.netProfit)
  const [lo, hi] = domainWithZero(values)
  const y = linearScale([lo, hi], [H - PAD.bottom, PAD.top])
  const zeroY = y(0)

  const plotWidth = W - PAD.left - PAD.right
  const slot = plotWidth / periods.length
  const barWidth = Math.max(3, slot - GAP)

  const active = hover === null ? null : periods[hover]

  return (
    <figure className="graph">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="graph__svg"
        role="img"
        aria-label={`Bénéfice net par période, de ${periods[0].key} à ${periods[periods.length - 1].key}`}
        onPointerLeave={() => setHover(null)}
      >
        {niceTicks(lo, hi, 3).map((tick) => (
          <line
            key={tick}
            x1={PAD.left} x2={W - PAD.right}
            y1={y(tick)} y2={y(tick)}
            className={tick === 0 ? 'graph__zero' : 'graph__grid'}
          />
        ))}

        {periods.map((period, i) => {
          const top = Math.min(zeroY, y(period.netProfit))
          const height = Math.max(1, Math.abs(y(period.netProfit) - zeroY))
          const positive = period.netProfit >= 0
          return (
            <rect
              key={period.key}
              x={PAD.left + i * slot + GAP / 2}
              y={top}
              width={barWidth}
              height={height}
              /*
               * Un seul rayon, appliqué aux quatre coins : l'extrémité ancrée à
               * la ligne de zéro est de toute façon masquée par la barre voisine
               * du signe opposé, et c'est bien plus simple qu'un tracé sur mesure.
               */
              rx={Math.min(RADIUS, barWidth / 2)}
              className="graph__bar"
              data-tone={positive ? 'positive' : 'negative'}
              data-active={hover === i}
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
            />
          )
        })}

        <text x={PAD.left} y={H - 6} className="graph__axis">{periods[0].key}</text>
        {periods.length > 1 && (
          <text x={W - PAD.right} y={H - 6} textAnchor="end" className="graph__axis">
            {periods[periods.length - 1].key}
          </text>
        )}
      </svg>

      <figcaption className="graph__caption">
        {active === null ? (
          <>Touche une barre pour le détail de la période.</>
        ) : (
          <>
            {active.key} : <strong>{formatKamas(active.netProfit, { signed: true })}</strong>
            {' · '}investi {formatKamas(active.invested)}
            {' · '}récupéré {formatKamas(active.recovered)}
            {' · '}taxes {formatKamas(active.taxes)}
          </>
        )}
      </figcaption>
    </figure>
  )
}
