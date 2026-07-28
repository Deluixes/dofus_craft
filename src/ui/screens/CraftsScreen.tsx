import { useMemo, useState } from 'react'
import { useAppState } from '../AppState'
import { rankCrafts, type RankedCraft } from '../../domain/craftRanking'
import { JOB_LABELS, type Job } from '../../catalog/types'
import { FreshnessDot } from '../components/FreshnessDot'
import { KamasAmount } from '../components/KamasAmount'

type SortKey = 'net' | 'pct'

export function CraftsScreen({ onOpen, onSurvey }: {
  onOpen: (itemId: number) => void
  onSurvey: () => void
}) {
  const { catalog, priceBook, settings } = useAppState()
  const [jobFilter, setJobFilter] = useState<Job | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('net')

  const { ranked, incomplete } = useMemo(
    () => rankCrafts(catalog!, priceBook, settings.jobLevels, Date.now(), settings.freshness),
    [catalog, priceBook, settings],
  )

  const visible = useMemo(() => {
    const list = jobFilter === 'all' ? ranked : ranked.filter((r) => r.job === jobFilter)
    return sort === 'net'
      ? list
      : [...list].sort((a, b) => b.margin!.pct - a.margin!.pct)
  }, [ranked, jobFilter, sort])

  const declaredJobs = Object.keys(settings.jobLevels) as Job[]

  return (
    <section className="crafts">
      <header className="crafts__header">
        <div className="crafts__filters" role="group" aria-label="Filtrer par métier">
          <button aria-pressed={jobFilter === 'all'} onClick={() => setJobFilter('all')}>Tous</button>
          {declaredJobs.map((job) => (
            <button key={job} aria-pressed={jobFilter === job} onClick={() => setJobFilter(job)}>
              {JOB_LABELS[job]}
            </button>
          ))}
        </div>
        <div className="crafts__sort" role="group" aria-label="Trier">
          <button aria-pressed={sort === 'net'} onClick={() => setSort('net')}>Marge</button>
          <button aria-pressed={sort === 'pct'} onClick={() => setSort('pct')}>%</button>
        </div>
      </header>

      {incomplete.length > 0 && (
        <button className="crafts__banner" onClick={onSurvey}>
          {incomplete.length} craft{incomplete.length > 1 ? 's' : ''} non classé
          {incomplete.length > 1 ? 's' : ''}, il manque des prix — Relever
        </button>
      )}

      {declaredJobs.length === 0 && (
        <p className="crafts__empty">
          Déclare tes niveaux de métier dans les réglages pour voir tes crafts.
        </p>
      )}

      <ul className="crafts__list">
        {visible.map((craft) => (
          <CraftRow key={craft.resultItemId} craft={craft} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  )
}

function CraftRow({ craft, onOpen }: { craft: RankedCraft; onOpen: (id: number) => void }) {
  const { catalog } = useAppState()
  const item = catalog!.itemsById.get(craft.resultItemId)
  if (!item) return null

  return (
    <li>
      <button className="craft-row" onClick={() => onOpen(craft.resultItemId)}>
        <img src={item.imgUrl} alt="" width={40} height={40} loading="lazy" />
        <span className="craft-row__name">
          {item.name}
          <span className="craft-row__level">Niv. {item.level}</span>
        </span>
        <span className="craft-row__margin">
          <KamasAmount value={craft.margin!.net} signed />
          <span className="craft-row__pct">{(craft.margin!.pct * 100).toFixed(0)} %</span>
        </span>
        <FreshnessDot level={craft.confidence} />
      </button>
    </li>
  )
}
