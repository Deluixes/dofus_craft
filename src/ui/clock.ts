/**
 * Frontière entre les dates affichées et les instants stockés.
 *
 * Toutes les dates métier du registre sont enregistrées à **minuit local** du
 * jour choisi. `ledger.dayKey` relit ce même jour local, si bien que
 * l'aller-retour saisie → regroupement est stable par construction : une vente
 * notée le 3 compte le 3, quel que soit l'endroit d'où on consulte.
 */

export function startOfDay(at: number): number {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfToday(): number {
  return startOfDay(Date.now())
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format attendu par `<input type="date">`, en composantes locales. */
export function toDateInput(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Lit un `<input type="date">`. Le champ rend « AAAA-MM-JJ » ; construire la
 * date composante par composante évite l'écueil de `new Date('2026-09-07')`,
 * que la norme interprète en UTC et qui recule donc d'un jour à l'ouest de
 * Greenwich.
 */
export function fromDateInput(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return startOfToday()
  return new Date(year, month - 1, day).getTime()
}
