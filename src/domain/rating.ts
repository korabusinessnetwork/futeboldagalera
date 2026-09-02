import { RATING_FALLBACK } from './constants'
import type { PlayerStats } from './types'

/**
 * Secao 4.1 da spec, transcrita:
 *   0.60*aproveitamento + 0.25*(taxaVitoria*100) + 0.15*(min(golsPorJogo,1)*100)
 * Quem nunca jogou nao tem nota.
 */
export function calcRating(s: Pick<PlayerStats, 'games' | 'v' | 'goals' | 'pct'> | null | undefined): number | null {
  if (!s || !s.games) return null
  const winRate = s.v / s.games
  const gpg = Math.min(s.goals / s.games, 1) // gols por jogo, teto 1
  return 0.6 * s.pct + 0.25 * (winRate * 100) + 0.15 * (gpg * 100)
}

/** Media do grupo, usada por quem nunca jogou e por todo avulso. Fallback 50. */
export function groupAverageRating(ratings: Array<number | null>): number {
  const known = ratings.filter((r): r is number => r != null)
  if (!known.length) return RATING_FALLBACK
  return known.reduce((a, b) => a + b, 0) / known.length
}

/** Mapa id -> nota, ja com o fallback da media do grupo aplicado. */
export function ratingTable(stats: PlayerStats[]): { byId: Map<string, number>; avg: number } {
  const raw = new Map<string, number | null>()
  for (const s of stats) raw.set(s.id, calcRating(s))
  const avg = groupAverageRating([...raw.values()])
  const byId = new Map<string, number>()
  for (const [id, r] of raw) byId.set(id, r ?? avg)
  return { byId, avg }
}
