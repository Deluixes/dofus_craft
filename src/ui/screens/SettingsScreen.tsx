import { useRef, useState } from 'react'
import { useAppState } from '../AppState'
import { JOB_LABELS, type Job } from '../../catalog/types'
import { db } from '../../store/db'
import { exportBackup, importBackup, type BackupPayload } from '../../store/backup'
import { RUNES } from '../../catalog/statWeights'

// Tous les métiers qui fabriquent quelque chose dans le catalogue Touch — la
// liste complète de 17 (Job en compte 18 avec `inconnu`, qui n'est pas un
// métier praticable). Dofus Touch est figé sur une base 2.x antérieure à la
// fusion des métiers ; éleveur, boucher, poissonnier et boulanger en font
// partie au même titre que les huit historiques. Un métier laissé à 0 masque
// simplement ses recettes du classement — c'est le comportement voulu pour un
// métier que le joueur ne pratique pas encore.
const CRAFT_JOBS: Job[] = [
  'tailleur', 'bijoutier', 'cordonnier', 'forgeron',
  'sculpteur', 'faconneur', 'bricoleur', 'alchimiste',
  'paysan', 'mineur', 'bucheron', 'pecheur', 'chasseur',
  'eleveur', 'boucher', 'poissonnier', 'boulanger',
]

export function SettingsScreen() {
  const { catalog, settings, saveSettings } = useAppState()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const setJobLevel = (job: Job, level: number) =>
    void saveSettings({ ...settings, jobLevels: { ...settings.jobLevels, [job]: level } })

  const download = async () => {
    const payload = await exportBackup(db)
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `krosmarge-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const upload = async (file: File) => {
    if (!confirm('Cette restauration remplace tes prix et tes ventes actuels. Continuer ?')) return
    try {
      await importBackup(db, JSON.parse(await file.text()) as BackupPayload)
      setMessage('Sauvegarde restaurée. Recharge la page.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import impossible')
    }
  }

  return (
    <section className="settings">
      <h2>Niveaux de métier</h2>
      <p className="settings__hint">
        Seuls les crafts que ces niveaux autorisent apparaissent dans le classement.
      </p>
      {CRAFT_JOBS.map((job) => (
        <label key={job} className="settings__job">
          <span>{JOB_LABELS[job]}</span>
          <input
            type="number" min={0} max={200}
            value={settings.jobLevels[job] ?? 0}
            onChange={(e) => setJobLevel(job, Math.min(200, Math.max(0, Number(e.target.value))))}
          />
        </label>
      ))}

      <h2>Fraîcheur des prix</h2>
      <label className="settings__job">
        <span>Frais en deçà de (heures)</span>
        <input
          type="number" min={1}
          value={settings.freshness.freshHours}
          onChange={(e) => void saveSettings({
            ...settings,
            freshness: { ...settings.freshness, freshHours: Number(e.target.value) },
          })}
        />
      </label>
      <label className="settings__job">
        <span>Périmé au-delà de (heures)</span>
        <input
          type="number" min={1}
          value={settings.freshness.staleHours}
          onChange={(e) => void saveSettings({
            ...settings,
            freshness: { ...settings.freshness, staleHours: Number(e.target.value) },
          })}
        />
      </label>

      <h2>Runes de brisage</h2>
      <p className="settings__hint">
        Associe chaque statistique à sa rune dans le catalogue. Les statistiques
        non associées sont ignorées par l'estimation de brisage.
      </p>
      {RUNES.map((rune) => (
        <label key={rune.statName} className="settings__rune">
          <span>{rune.statName}</span>
          <input
            type="number" min={0}
            value={settings.runeItemIds[rune.statName] ?? 0}
            onChange={(e) => void saveSettings({
              ...settings,
              runeItemIds: { ...settings.runeItemIds, [rune.statName]: Number(e.target.value) },
            })}
          />
          <span className="settings__rune-name">
            {catalog!.itemsById.get(settings.runeItemIds[rune.statName] ?? 0)?.name ?? 'non associée'}
          </span>
        </label>
      ))}

      <h2>Sauvegarde</h2>
      <p className="settings__hint">
        Tes relevés de prix représentent des heures passées à l'HDV : exporte-les
        régulièrement. L'import remplace intégralement les données actuelles.
      </p>
      <button type="button" onClick={() => void download()}>Exporter mes données</button>
      <button type="button" onClick={() => fileInput.current?.click()}>Importer une sauvegarde</button>
      <input
        ref={fileInput} type="file" accept="application/json" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }}
      />
      {message && <p className="settings__message">{message}</p>}

      <h2>Catalogue</h2>
      <p className="settings__hint">
        Version {catalog!.version} — {catalog!.itemsById.size} objets, {catalog!.recipeByResultId.size} recettes.
      </p>
    </section>
  )
}
