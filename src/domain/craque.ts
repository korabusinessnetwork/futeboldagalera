import { CRAQUE_CLOSE_MIN, CRAQUE_OPEN_MIN } from './constants'
import { lineupPlayers } from './draw'
import type { Match, TeamKey } from './types'

export type CraqueState = 'before' | 'open' | 'closed' | 'finalized'

interface ZonedNow {
  date: string // yyyy-mm-dd no fuso do tenant
  minutes: number // minutos desde a meia-noite
}

/** Converte um Date para a data/hora local do fuso do grupo, sem biblioteca. */
export function zonedNow(now: Date, timeZone: string): ZonedNow {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/**
 * Secao 3.7 da spec. A janela automatica e 21:30 -> 22:30 no fuso do grupo,
 * no dia da partida. `voteOpen` / `voteClosed` sao overrides manuais do admin,
 * e `craque` definido encerra tudo.
 */
export function craqueState(match: Match, now: Date, timeZone = 'America/Sao_Paulo'): CraqueState {
  if (match.craque) return 'finalized'
  if (match.voteClosed) return 'closed'
  if (match.voteOpen) return 'open'

  const z = zonedNow(now, timeZone)
  if (z.date < match.date) return 'before'
  if (z.date > match.date) return 'closed'
  if (z.minutes < CRAQUE_OPEN_MIN) return 'before'
  if (z.minutes < CRAQUE_CLOSE_MIN) return 'open'
  return 'closed'
}

/** Milissegundos ate a abertura da votacao. Negativo quando ja passou. */
export function msUntilOpen(match: Match, now: Date, timeZone = 'America/Sao_Paulo'): number {
  const z = zonedNow(now, timeZone)
  const nowMin = z.minutes
  const dayDiff =
    (Date.parse(`${match.date}T00:00:00Z`) - Date.parse(`${z.date}T00:00:00Z`)) / 86_400_000
  return (dayDiff * 1440 + CRAQUE_OPEN_MIN - nowMin) * 60_000
}

export interface Eligible {
  id: string
  name: string
  team: TeamKey
  slot?: string
  starter: boolean
}

/** Elegiveis: titulares, goleiros e reservas dos dois times. */
export function eligibleForCraque(match: Match): Eligible[] {
  if (!match.lineup) return []
  const res = new Set<string>()
  for (const key of ['branco', 'preto'] as const) {
    for (const p of match.lineup.teams[key].res) res.add(p.id)
  }
  return lineupPlayers(match.lineup).map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    slot: p.slot,
    starter: !res.has(p.id),
  }))
}

export interface VoteRow {
  id: string
  votes: number
  pct: number
}

export function tallyVotes(match: Match): { rows: VoteRow[]; total: number; leaders: string[] } {
  const votes = match.votes ?? {}
  const total = Object.values(votes).reduce((a, b) => a + b, 0)
  const rows = Object.entries(votes)
    .map(([id, v]) => ({ id, votes: v, pct: total ? (v / total) * 100 : 0 }))
    .sort((a, b) => b.votes - a.votes)
  const top = rows[0]?.votes ?? 0
  const leaders = top > 0 ? rows.filter((r) => r.votes === top).map((r) => r.id) : []
  return { rows, total, leaders }
}

export const voteStorageKey = (matchId: string) => `craqueVote_${matchId}`
