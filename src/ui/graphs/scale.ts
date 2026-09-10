/**
 * La seule partie calculatoire des graphiques, donc la seule testée. Le rendu
 * SVG lui-même se vérifie à l'œil.
 */

export interface LinearScale {
  (value: number): number
  domain: [number, number]
  range: [number, number]
}

/**
 * Échelle linéaire domaine → pixels. Un domaine plat (min === max) est projeté
 * au milieu de la plage plutôt que de produire une division par zéro : une
 * seule journée de données doit s'afficher, pas planter.
 */
export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0

  const scale = ((value: number) =>
    span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0)) as LinearScale

  scale.domain = domain
  scale.range = range
  return scale
}

/**
 * Graduations « rondes » : des multiples de 1, 2 ou 5 fois une puissance de dix.
 *
 * Des graduations calculées à `(max - min) / n` donneraient des repères du genre
 * 3 271 k, illisibles d'un coup d'œil. On préfère un nombre de graduations
 * approximatif mais des valeurs rondes.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) return [min]

  const span = max - min
  const magnitude = 10 ** Math.floor(Math.log10(span / Math.max(1, count)))

  /*
   * On retient le pas rond dont le nombre d'intervalles est le plus proche de
   * la cible EN RAPPORT, et non en écart absolu. Comparer les écarts favorise
   * systématiquement les pas trop grands : pour 0 à 100 en quatre graduations,
   * 2 intervalles est à 2 de la cible et 5 intervalles à 1, mais c'est bien
   * 5 qu'on veut — et en écart absolu on obtiendrait [0, 50, 100].
   */
  let step = magnitude
  let best = Infinity
  for (const factor of [1, 2, 5, 10]) {
    const candidate = factor * magnitude
    const distance = Math.abs(Math.log(span / candidate / count))
    if (distance < best) {
      best = distance
      step = candidate
    }
  }

  const ticks: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + step / 1000; t += step) {
    // Le cumul de flottants dérive : on ré-arrondit sur le pas.
    ticks.push(Math.round(t / step) * step)
  }
  return ticks
}

/**
 * Étend un domaine pour qu'il contienne toujours zéro.
 *
 * Sur un graphique de bénéfice, masquer la ligne de zéro ferait passer une
 * série entièrement négative pour une progression.
 */
export function domainWithZero(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  return min === max ? [min, min + 1] : [min, max]
}
