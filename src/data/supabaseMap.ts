/**
 * Traducao linha do Postgres <-> tipo de dominio.
 *
 * Tudo aqui e funcao pura: nao toca em rede, DOM nem localStorage. E de
 * proposito — e a parte do adapter que da para testar sem banco, e onde moram
 * as tres divergencias entre o schema e o dominio:
 *
 *   1. time: o dominio usa `branco`/`preto`, o banco usa `a`/`b`
 *   2. `pending` do dominio e uma coluna `status` no banco (draft/pending/finished)
 *   3. `voteOpen`/`voteClosed` sao um `vote_state` unico no banco
 */
import type {
  Formation,
  LinePos,
  Lineup,
  Match,
  MatchEntry,
  Player,
  PosCode,
  PositionDef,
  Result,
  Subscription,
  TeamKey,
  Tenant,
  TenantBranding,
  VoteState,
} from '../domain/types'

// ------------------------------------------------------------------ colunas
// Campos sempre explicitos: nenhum select('*') em tabela de dominio.

export const TENANT_COLS =
  'id, slug, name, tagline, logo_url, primary_color, instagram_url, timezone, team_a_name, team_b_name, team_colors, positions'
export const PLAYER_COLS =
  'id, tenant_id, name, pos, photo_url, is_monthly, is_app, created_at, deleted_at'
export const MATCH_COLS =
  'id, tenant_id, date, season, status, score_a, score_b, lineup_published, vote_state, vote_opened_at, craque_player_id, formation_a, formation_b, draw_seed, lineup'
export const ENTRY_COLS =
  'match_id, player_id, team, slot, is_starter, out_of_position, rating_at_draw, result, goals, own_goals'
export const SUB_COLS =
  'tenant_id, plan_code, status, billing_mode, payment_method_on_file, trial_ends_at, current_period_end'

// -------------------------------------------------------------------- linhas

export interface TenantRow {
  id: string
  slug: string
  name: string
  tagline: string | null
  logo_url: string | null
  primary_color: string
  instagram_url: string | null
  timezone: string
  team_a_name: string
  team_b_name: string
  team_colors: Record<TeamKey, string> | null
  positions: PositionDef[] | null
}

export interface PlayerRow {
  id: string
  tenant_id: string
  name: string
  pos: PosCode | null
  photo_url: string | null
  is_monthly: boolean
  is_app: boolean
  created_at: string | null
  deleted_at: string | null
}

export interface MatchRow {
  id: string
  tenant_id: string
  date: string
  season: string | null
  status: 'draft' | 'pending' | 'finished'
  score_a: number | null
  score_b: number | null
  lineup_published: boolean
  vote_state: VoteState
  vote_opened_at: string | null
  craque_player_id: string | null
  formation_a: string | null
  formation_b: string | null
  draw_seed: number | null
  lineup: Lineup | null
}

export interface EntryRow {
  match_id: string
  player_id: string
  team: 'a' | 'b'
  slot: string | null
  is_starter: boolean
  out_of_position: boolean
  rating_at_draw: number | null
  result: Result | null
  goals: number
  own_goals: number
}

export interface SubscriptionRow {
  tenant_id: string
  plan_code: Subscription['planCode']
  status: Subscription['status']
  billing_mode: Subscription['billingMode']
  payment_method_on_file: boolean
  trial_ends_at: string | null
  current_period_end: string | null
}

// --------------------------------------------------------------------- time

export function teamToDb(key: TeamKey): 'a' | 'b' {
  return key === 'branco' ? 'a' : 'b'
}

export function teamFromDb(team: 'a' | 'b'): TeamKey {
  return team === 'a' ? 'branco' : 'preto'
}

/**
 * Resultado do time a partir do placar. Serve para as linhas em que `result`
 * ficou null: a partida pendente vira finalizada quando o placar chega, e o
 * resultado e derivavel — melhor derivar do que chutar empate.
 */
export function resultFor(
  team: TeamKey,
  scoreBranco: number | null,
  scorePreto: number | null,
): Result {
  if (scoreBranco === null || scorePreto === null || scoreBranco === scorePreto) return 'e'
  const brancoVenceu = scoreBranco > scorePreto
  return (team === 'branco') === brancoVenceu ? 'v' : 'd'
}

// ------------------------------------------------------------------- tenant

export function tenantFromRow(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    branding: {
      name: row.name,
      tagline: row.tagline ?? undefined,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      instagramUrl: row.instagram_url,
      timezone: row.timezone,
      teamNames: { branco: row.team_a_name, preto: row.team_b_name },
      ...(row.team_colors ? { teamColors: row.team_colors } : {}),
      ...(row.positions ? { positions: row.positions } : {}),
    },
  }
}

/** Patch parcial: so vira coluna o que o chamador realmente mandou. */
export function brandingToRow(patch: Partial<TenantBranding>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.tagline !== undefined) row.tagline = patch.tagline ?? null
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl
  if (patch.primaryColor !== undefined) row.primary_color = patch.primaryColor
  if (patch.instagramUrl !== undefined) row.instagram_url = patch.instagramUrl
  if (patch.timezone !== undefined) row.timezone = patch.timezone
  if (patch.teamNames !== undefined) {
    row.team_a_name = patch.teamNames.branco
    row.team_b_name = patch.teamNames.preto
  }
  if (patch.teamColors !== undefined) row.team_colors = patch.teamColors
  if (patch.positions !== undefined) row.positions = patch.positions
  return row
}

// ------------------------------------------------------------------ jogador

export function playerFromRow(row: PlayerRow): Player {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    pos: row.pos,
    photoUrl: row.photo_url,
    app: row.is_app,
    isMonthly: row.is_monthly,
    createdAt: row.created_at ?? undefined,
    deletedAt: row.deleted_at,
  }
}

export function playerPatchToRow(
  patch: Partial<Pick<Player, 'name' | 'pos' | 'photoUrl'>>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.pos !== undefined) row.pos = patch.pos
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl
  return row
}

// ------------------------------------------------------------------ partida

/** `pending` do dominio + placar viram a coluna `status`. */
export function statusOf(
  pending: boolean | undefined,
  hasScore: boolean,
): MatchRow['status'] {
  if (pending) return 'pending'
  return hasScore ? 'finished' : 'draft'
}

export function voteStateToRow(
  state: VoteState,
  now: string,
): Pick<MatchRow, 'vote_state' | 'vote_opened_at'> {
  // O carimbo e o que faz a votacao aberta na mao fechar sozinha em 30 min.
  return { vote_state: state, vote_opened_at: state === 'open' ? now : null }
}

const FORM_ORDER: LinePos[] = ['ZAG', 'VOL', 'MC', 'ATA']

/** "2-1-2-1", para auditoria nas colunas formation_a/formation_b. */
export function formationToText(form: Formation | undefined): string | null {
  if (!form) return null
  return FORM_ORDER.map((k) => form[k] ?? 0).join('-')
}

interface SlotInfo {
  slot: string | null
  starter: boolean
  oop: boolean
  rating: number | null
}

/** Procura o jogador na escalacao para preencher slot/reserva/nota congelada. */
export function lineupSlotOf(
  lineup: Lineup | null | undefined,
  playerId: string,
): SlotInfo | null {
  if (!lineup) return null
  for (const key of ['branco', 'preto'] as TeamKey[]) {
    const side = lineup.teams?.[key]
    if (!side) continue
    const starters = [side.gk, ...(side.line ?? [])]
    for (const p of starters) {
      if (p && p.id === playerId) {
        return { slot: p.slot ?? null, starter: true, oop: Boolean(p.oop), rating: p.rating ?? null }
      }
    }
    for (const p of side.res ?? []) {
      if (p.id === playerId) {
        return { slot: p.slot ?? null, starter: false, oop: Boolean(p.oop), rating: p.rating ?? null }
      }
    }
  }
  return null
}

export function entryFromRow(
  row: EntryRow,
  scoreBranco: number | null,
  scorePreto: number | null,
): MatchEntry {
  const team = teamFromDb(row.team)
  return {
    playerId: row.player_id,
    team,
    result: row.result ?? resultFor(team, scoreBranco, scorePreto),
    goals: row.goals,
    og: row.own_goals,
  }
}

/**
 * Entrada do dominio -> linha. `slot`, `is_starter` e `out_of_position` saem da
 * escalacao quando ela existe: o schema guarda isso normalizado e a UI le do
 * blob, entao os dois precisam contar a mesma historia.
 */
export function entryToRow(matchId: string, entry: MatchEntry, lineup?: Lineup | null): EntryRow {
  const slotInfo = lineupSlotOf(lineup, entry.playerId)
  return {
    match_id: matchId,
    player_id: entry.playerId,
    team: teamToDb(entry.team),
    slot: slotInfo?.slot ?? null,
    is_starter: slotInfo ? slotInfo.starter : true,
    out_of_position: slotInfo ? slotInfo.oop : false,
    rating_at_draw: slotInfo?.rating ?? null,
    result: entry.result,
    goals: entry.goals ?? 0,
    own_goals: entry.og ?? 0,
  }
}

export function matchFromRow(
  row: MatchRow,
  entries: EntryRow[],
  votes: Record<string, number>,
): Match {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    date: row.date,
    pending: row.status === 'pending',
    scoreBranco: row.score_a,
    scorePreto: row.score_b,
    escalaPub: row.lineup_published,
    entries: entries.map((e) => entryFromRow(e, row.score_a, row.score_b)),
    lineup: row.lineup,
    votes,
    voteOpen: row.vote_state === 'open' ? true : undefined,
    voteOpenedAt: row.vote_opened_at,
    voteClosed: row.vote_state === 'closed' ? true : undefined,
    craque: row.craque_player_id,
    season: row.season ?? row.date.slice(0, 4),
  }
}

// ---------------------------------------------------------------- assinatura

export function subscriptionFromRow(row: SubscriptionRow): Subscription {
  return {
    tenantId: row.tenant_id,
    planCode: row.plan_code,
    status: row.status,
    billingMode: row.billing_mode,
    paymentMethodOnFile: row.payment_method_on_file,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
  }
}
