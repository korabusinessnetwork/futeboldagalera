import { FORMACAO_DEFAULT, parseFormation } from '../domain/constants'
import type {
  Lineup,
  LineupPlayer,
  Match,
  MatchEntry,
  Player,
  Pos,
  TeamKey,
  TenantData,
} from '../domain/types'
import { defaultTenant, demoSubscription } from './tenant'

/**
 * Fase 5 da spec: importador do JSON exportado do app antigo.
 * Formato de origem: { players, matches } global, sem tenant.
 */

export interface LegacyPlayer {
  id: string
  name: string
  pos?: string | null
  photo?: string | null
  app?: boolean
}

export interface LegacyMatch {
  id: string
  date: string
  pending?: boolean
  scoreBranco?: number | null
  scorePreto?: number | null
  escalaPub?: boolean
  entries?: Array<{ playerId: string; team?: string; result?: string; goals?: number; og?: number }>
  lineup?: unknown
  votes?: Record<string, number>
  voteOpen?: boolean
  voteClosed?: boolean
  craque?: string | null
}

export interface LegacyDump {
  players?: LegacyPlayer[]
  matches?: LegacyMatch[]
}

const POS_OK: Pos[] = ['GOL', 'ZAG', 'VOL', 'MC', 'ATA']

function toPos(v: unknown): Pos | null {
  const s = String(v ?? '').toUpperCase()
  return (POS_OK as string[]).includes(s) ? (s as Pos) : null
}

function toLineupPlayer(v: any): LineupPlayer {
  return {
    id: String(v?.id ?? ''),
    name: String(v?.name ?? ''),
    pos: toPos(v?.pos),
    rating: Number(v?.rating ?? 0),
    avulso: Boolean(v?.avulso),
    slot: toPos(v?.slot) ?? undefined,
    // o dump antigo grava `oop` ora booleano, ora com o nome do slot
    oop: typeof v?.oop === 'string' ? true : Boolean(v?.oop),
    j: typeof v?.j === 'number' ? v.j : undefined,
  }
}

function toLineup(v: any): Lineup | null {
  if (!v?.teams) return null
  const teams = {} as Lineup['teams']
  for (const key of ['branco', 'preto'] as TeamKey[]) {
    const t = v.teams[key] ?? {}
    const line = Array.isArray(t.line) ? t.line.map(toLineupPlayer) : []
    const res = Array.isArray(t.res) ? t.res.map(toLineupPlayer) : []
    teams[key] = {
      gk: t.gk ? toLineupPlayer(t.gk) : null,
      line,
      res,
      total:
        typeof t.total === 'number'
          ? t.total
          : [...line, ...res].reduce((a, p) => a + p.rating, 0),
    }
  }
  return {
    teams,
    formB: v.formB ?? parseFormation(FORMACAO_DEFAULT),
    formP: v.formP ?? parseFormation(FORMACAO_DEFAULT),
  }
}

/**
 * Reconstroi o nome canonico dos jogadores dentro da escalacao. O dump antigo
 * gravava o nome de exibicao ("Felipe", "Ze"), nao o nome cadastrado.
 */
function relinkNames(lineup: Lineup | null, byId: Map<string, Player>): Lineup | null {
  if (!lineup) return null
  const fix = (p: LineupPlayer | null) => {
    if (!p) return p
    const canon = byId.get(p.id)
    if (canon) p.name = canon.name
    return p
  }
  for (const key of ['branco', 'preto'] as TeamKey[]) {
    const t = lineup.teams[key]
    fix(t.gk)
    t.line.forEach(fix)
    t.res.forEach(fix)
  }
  return lineup
}

export function importLegacy(dump: LegacyDump, tenantId: string): { players: Player[]; matches: Match[] } {
  const players: Player[] = (dump.players ?? []).map((p) => ({
    id: p.id,
    tenantId,
    name: p.name,
    pos: toPos(p.pos),
    photoUrl: p.photo ?? null,
    app: Boolean(p.app),
    isMonthly: true,
    deletedAt: null,
  }))
  const byId = new Map(players.map((p) => [p.id, p]))
  const known = new Set(players.map((p) => p.id))

  const matches: Match[] = (dump.matches ?? []).map((m) => {
    const entries: MatchEntry[] = (m.entries ?? [])
      .filter((e) => known.has(e.playerId))
      .map((e) => ({
        playerId: e.playerId,
        team: (e.team === 'preto' ? 'preto' : 'branco') as TeamKey,
        result: e.result === 'v' || e.result === 'e' || e.result === 'd' ? e.result : 'e',
        goals: Number(e.goals ?? 0),
        og: e.og ? Number(e.og) : 0,
      }))
    return {
      id: m.id,
      tenantId,
      date: m.date,
      pending: Boolean(m.pending),
      scoreBranco: m.scoreBranco ?? null,
      scorePreto: m.scorePreto ?? null,
      escalaPub: m.escalaPub !== false,
      entries,
      lineup: relinkNames(toLineup(m.lineup), byId),
      votes: m.votes ?? {},
      voteOpen: m.voteOpen,
      voteClosed: m.voteClosed,
      craque: m.craque ?? null,
      season: m.date.slice(0, 4),
    }
  })

  matches.sort((a, b) => a.date.localeCompare(b.date))
  return { players, matches }
}

export function tenantDataFromLegacy(dump: LegacyDump): TenantData {
  const tenant = defaultTenant()
  const { players, matches } = importLegacy(dump, tenant.id)
  return { tenant, players, matches, subscription: demoSubscription(tenant.id) }
}

/** Exporta de volta no formato do app antigo, para backup. */
export function exportLegacy(data: TenantData): LegacyDump {
  return {
    players: data.players
      .filter((p) => !p.deletedAt)
      .map((p) => ({ id: p.id, name: p.name, pos: p.pos, photo: p.photoUrl ?? undefined, app: p.app })),
    matches: data.matches.map((m) => ({
      id: m.id,
      date: m.date,
      pending: m.pending,
      scoreBranco: m.scoreBranco,
      scorePreto: m.scorePreto,
      escalaPub: m.escalaPub,
      entries: m.entries,
      lineup: m.lineup ?? undefined,
      votes: m.votes,
      voteOpen: m.voteOpen,
      voteClosed: m.voteClosed,
      craque: m.craque,
    })),
  }
}
