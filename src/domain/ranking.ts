import type { PlayerStats, RankedRow, ScorerRow } from './types'

/**
 * Empate real compartilha a mesma posicao.
 * Duas linhas so empatam se TODAS as chaves comparadas forem iguais.
 */
export function assignRanks<T>(rows: T[], keys: Array<keyof T>): Array<T & { rank: number }> {
  const out: Array<T & { rank: number }> = []
  let rank = 0
  let prev: T | null = null
  rows.forEach((row, i) => {
    const same = prev != null && keys.every((k) => row[k] === prev![k])
    if (!same) rank = i + 1
    out.push({ ...row, rank })
    prev = row
  })
  return out
}

/** Ordenacao do ranking: pts desc, vitorias desc, aproveitamento desc, jogos desc, nome asc. */
export function sortRanking(a: PlayerStats, b: PlayerStats): number {
  return (
    b.pts - a.pts ||
    b.v - a.v ||
    b.pct - a.pct ||
    b.games - a.games ||
    a.name.localeCompare(b.name, 'pt-BR')
  )
}

/** Jogadores sem jogo nao aparecem no ranking. */
export function buildRanking(stats: PlayerStats[]): RankedRow[] {
  const rows = stats.filter((s) => s.games > 0).sort(sortRanking)
  return assignRanks(rows, ['pts', 'v', 'pct', 'games'])
}

/** Ordenacao da artilharia: gols desc, jogos desc, nome asc. */
export function sortScorers(a: PlayerStats, b: PlayerStats): number {
  return b.goals - a.goals || b.games - a.games || a.name.localeCompare(b.name, 'pt-BR')
}

/** So aparece quem tem gol. */
export function buildScorers(stats: PlayerStats[]): ScorerRow[] {
  const rows = stats.filter((s) => s.goals > 0).sort(sortScorers)
  const ranked = assignRanks(rows, ['goals', 'games'])
  return ranked.map((r) => ({
    id: r.id,
    name: r.name,
    pos: r.pos,
    goals: r.goals,
    games: r.games,
    avg: r.games ? r.goals / r.games : 0,
    rank: r.rank,
  }))
}

export function totalGoals(stats: PlayerStats[]): number {
  return stats.reduce((acc, s) => acc + s.goals, 0)
}
