import { useState } from 'react'
import { linearScale, niceTicks, domainWithZero } from './scale'
import { formatKamas } from '../components/KamasAmount'
import type { CurvePoint } from '../../domain/ledger'

const W = 320
const H = 170
const PAD = { top: 12, right: 10, bottom: 22, left: 10 }

/**
 * Courbe du bénéfice réalisé cumulé.
 *
 * **Série unique, donc aucune légende** : le titre de la section la nomme déjà.
 * Le domaine vertical contient toujours zéro — sans quoi une série entièrement
 * négative se dessinerait comme une progression, l'axe se recalant sur ses
 * propres valeurs.
 *
 * Les valeurs ne sont pas étiquetées point par point : seul le dernier point
 * porte son montant, le reste se lit au survol ou au toucher.
 */
export function CumulativeCurve({ points }: { points: CurvePoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="graph__empty">Pas encore de quoi tracer une courbe.</p>
  }

  const values = points.map((p) => p.profit)
  const [lo, hi] = domainWithZero(values)
  const x = linearScale([0, Math.max(1, points.length - 1)], [PAD.left, W - PAD.right])
  const y = linearScale([lo, hi], [H - PAD.bottom, PAD.top])
  const zeroY = y(0)

  const coords = points.map((p, i) => [x(i), y(p.profit)] as const)
  const line = coords.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = [
    `M ${coords[0][0].toFixed(1)},${zeroY.toFixed(1)}`,
    ...coords.map(([px, py]) => `L ${px.toFixed(1)},${py.toFixed(1)}`),
    `L ${coords[coords.length - 1][0].toFixed(1)},${zeroY.toFixed(1)}`,
    'Z',
  ].join(' ')

  const last = points[points.length - 1]
  const active = hover === null ? null : points[hover]

  /** Point de données le plus proche du doigt, en coordonnées du viewBox. */
  function pick(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const viewX = ((event.clientX - box.left) / box.width) * W
    const plotWidth = W - PAD.left - PAD.right
    const ratio = (viewX - PAD.left) / plotWidth
    const index = Math.round(ratio * (points.length - 1))
    setHover(Math.min(points.length - 1, Math.max(0, index)))
  }

  return (
    <figure className="graph">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="graph__svg"
        role="img"
        aria-label={`Bénéfice cumulé, de ${points[0].day} à ${last.day}, actuellement ${formatKamas(last.profit)}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        {niceTicks(lo, hi, 3).map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left} x2={W - PAD.right}
              y1={y(tick)} y2={y(tick)}
              className={tick === 0 ? 'graph__zero' : 'graph__grid'}
            />
            <text x={PAD.left} y={y(tick) - 3} className="graph__tick">{formatKamas(tick)}</text>
          </g>
        ))}

        <path d={area} className="graph__area" />
        <polyline points={line} className="graph__line" />

        <circle cx={x(points.length - 1)} cy={y(last.profit)} r={4} className="graph__last" />

        {active !== null && hover !== null && (
          <g>
            <line
              x1={x(hover)} x2={x(hover)}
              y1={PAD.top} y2={H - PAD.bottom}
              className="graph__crosshair"
            />
            <circle cx={x(hover)} cy={y(active.profit)} r={4} className="graph__last" />
          </g>
        )}

        <text x={PAD.left} y={H - 6} className="graph__axis">{points[0].day}</text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="graph__axis">{last.day}</text>
      </svg>

      <figcaption className="graph__caption">
        {active === null ? (
          <>Bénéfice cumulé au {last.day} : <strong>{formatKamas(last.profit, { signed: true })}</strong></>
        ) : (
          <>Au {active.day} : <strong>{formatKamas(active.profit, { signed: true })}</strong> cumulés</>
        )}
      </figcaption>
    </figure>
  )
}
