import type { Lineup, Match, MatchEntry, Result, TeamKey } from './types'

/** Auto-derivacao do V/E/D a partir do placar e do time do jogador (secao 3.4). */
export function deriveResult(team: TeamKey, scoreBranco: number | null, scorePreto: number | null): Result {
  if (scoreBranco == null || scorePreto == null) return 'e'
  if (scoreBranco === scorePreto) return 'e'
  const brancoVenceu = scoreBranco > scorePreto
  return team === 'branco' ? (brancoVenceu ? 'v' : 'd') : brancoVenceu ? 'd' : 'v'
}

export function applyScoreToEntries(
  entries: MatchEntry[],
  scoreBranco: number | null,
  scorePreto: number | null,
): MatchEntry[] {
  return entries.map((e) => ({ ...e, result: deriveResult(e.team, scoreBranco, scorePreto) }))
}

/** Monta as entradas de uma partida a partir da escalacao sorteada. */
export function entriesFromLineup(lineup: Lineup): MatchEntry[] {
  const out: MatchEntry[] = []
  for (const team of ['branco', 'preto'] as TeamKey[]) {
    const t = lineup.teams[team]
    const ids = [t.gk?.id, ...t.line.map((p) => p.id), ...t.res.map((p) => p.id)].filter(
      (id): id is string => !!id,
    )
    for (const playerId of ids) {
      // avulsos sao efemeros: so viram entrada quando ja existirem no elenco
      if (playerId.startsWith('av-')) continue
      out.push({ playerId, team, result: 'e', goals: 0, og: 0 })
    }
  }
  return out
}

export function winnerOf(m: Match): TeamKey | 'empate' | null {
  if (m.pending || m.scoreBranco == null || m.scorePreto == null) return null
  if (m.scoreBranco === m.scorePreto) return 'empate'
  return m.scoreBranco > m.scorePreto ? 'branco' : 'preto'
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function todayISO(timeZone = 'America/Sao_Paulo'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}
