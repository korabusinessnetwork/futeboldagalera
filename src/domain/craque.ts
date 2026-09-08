import { CRAQUE_CLOSE_MIN, CRAQUE_DURATION_MS, CRAQUE_OPEN_MIN } from './constants'
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
 * Secao 3.7 da spec. A votacao abre sozinha as 21:30 no fuso do grupo, no dia
 * da partida, e SEMPRE dura 30 minutos a partir da abertura. `voteOpenedAt` e
 * a abertura manual do admin (tambem com os 30 minutos), `voteClosed` e o
 * encerramento antecipado, e `craque` definido encerra tudo.
 */
export function craqueState(match: Match, now: Date, timeZone = 'America/Sao_Paulo'): CraqueState {
  if (match.craque) return 'finalized'
  if (match.voteClosed) return 'closed'

  if (match.voteOpen) {
    // Abertura manual: sem carimbo (dado antigo) fica aberta ate o admin encerrar.
    const deadline = manualDeadline(match)
    return deadline === null || now.getTime() < deadline ? 'open' : 'closed'
  }

  const z = zonedNow(now, timeZone)
  if (z.date < match.date) return 'before'
  if (z.date > match.date) return 'closed'
  if (z.minutes < CRAQUE_OPEN_MIN) return 'before'
  if (z.minutes < CRAQUE_CLOSE_MIN) return 'open'
  return 'closed'
}

/** Instante (ms epoch) em que uma abertura manual expira. null = sem carimbo. */
function manualDeadline(match: Match): number | null {
  if (!match.voteOpenedAt) return null
  const t = Date.parse(match.voteOpenedAt)
  return Number.isNaN(t) ? null : t + CRAQUE_DURATION_MS
}

/** Minutos zonados ate um horario do dia da partida, em ms. Negativo quando ja passou. */
function msUntilMinuteOfMatchDay(
  match: Match,
  targetMin: number,
  now: Date,
  timeZone: string,
): number {
  const z = zonedNow(now, timeZone)
  const dayDiff =
    (Date.parse(`${match.date}T00:00:00Z`) - Date.parse(`${z.date}T00:00:00Z`)) / 86_400_000
  return (dayDiff * 1440 + targetMin - z.minutes) * 60_000
}

/** Milissegundos ate a abertura da votacao. Negativo quando ja passou. */
export function msUntilOpen(match: Match, now: Date, timeZone = 'America/Sao_Paulo'): number {
  return msUntilMinuteOfMatchDay(match, CRAQUE_OPEN_MIN, now, timeZone)
}

/**
 * Milissegundos ate o fechamento automatico. `null` quando nao ha prazo a
 * mostrar (abertura manual antiga, sem carimbo). Negativo quando ja passou.
 */
export function msUntilClose(
  match: Match,
  now: Date,
  timeZone = 'America/Sao_Paulo',
): number | null {
  if (match.voteOpen) {
    const deadline = manualDeadline(match)
    return deadline === null ? null : deadline - now.getTime()
  }
  return msUntilMinuteOfMatchDay(match, CRAQUE_CLOSE_MIN, now, timeZone)
}

/** "21:30" a partir de minutos desde a meia-noite. */
export function minuteLabel(min: number): string {
  const h = Math.floor(min / 60) % 24
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
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
