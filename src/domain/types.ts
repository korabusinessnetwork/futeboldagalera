/** Tipos de dominio. Nada aqui conhece React, DOM ou banco. */

export type Pos = 'GOL' | 'ZAG' | 'VOL' | 'MC' | 'ATA'
export type LinePos = Exclude<Pos, 'GOL'>
/**
 * Codigo de posicao gravado no jogador. Pode ser um dos cinco base ou uma
 * posicao criada pelo grupo — que sempre aponta para um base, porque formacao,
 * sorteio e desenho do campo so sabem trabalhar com os cinco.
 */
export type PosCode = Pos | (string & {})

/** Posicao criada pelo grupo: rotulo proprio, papel conhecido pelo motor. */
export interface PositionDef {
  /** Sigla que o grupo ve, em caixa alta (ex.: ALA, LIB). */
  code: string
  /** Papel que o sorteio e a formacao usam no lugar dela. */
  base: Pos
}
export type Result = 'v' | 'e' | 'd'
export type TeamKey = 'branco' | 'preto'
export type MatchStatus = 'draft' | 'pending' | 'finished'
export type VoteState = 'auto' | 'open' | 'closed'

export interface Player {
  id: string
  tenantId: string
  name: string
  pos: PosCode | null
  photoUrl?: string | null
  /** "Goleiro App": pseudo-jogador, ignorado no ranking e na artilharia. */
  app?: boolean
  isMonthly?: boolean
  createdAt?: string
  deletedAt?: string | null
}

/** Jogador efemero do sorteio (nao vira cadastro ate a partida ser criada). */
export interface Avulso {
  id: string // prefixo "av-"
  name: string
  pos: PosCode | null
  avulso: true
}

export interface MatchEntry {
  playerId: string
  team: TeamKey
  result: Result
  goals: number
  /** Gols contra. */
  og?: number
}

/** Jogador ja posicionado dentro de uma escalacao. */
export interface LineupPlayer {
  id: string
  name: string
  pos: PosCode | null
  rating: number
  avulso: boolean
  /** Slot em que foi escalado (pode divergir de `pos`). */
  slot?: Pos
  /** true quando o slot difere da posicao natural. */
  oop?: boolean | string
  /** Rating com jitter aplicado no sorteio, preservado para auditoria. */
  j?: number
}

export interface LineupTeam {
  gk: LineupPlayer | null
  line: LineupPlayer[]
  res: LineupPlayer[]
  total: number
}

export type Formation = Record<LinePos, number>

export interface Lineup {
  teams: Record<TeamKey, LineupTeam>
  formB: Formation
  formP: Formation
  /** Semente usada no sorteio: permite reproduzir e provar que nao teve marmelada. */
  seed?: number
}

export interface Match {
  id: string
  tenantId: string
  date: string // ISO yyyy-mm-dd, sem hora
  /** Partida criada pela escalacao, ainda sem placar. NAO conta no ranking. */
  pending?: boolean
  scoreBranco: number | null
  scorePreto: number | null
  /** false = escalacao oculta dos atletas. */
  escalaPub?: boolean
  entries: MatchEntry[]
  lineup?: Lineup | null
  votes?: Record<string, number>
  voteOpen?: boolean
  /** Instante ISO em que a votacao foi aberta. Fecha sozinha 30 min depois. */
  voteOpenedAt?: string | null
  voteClosed?: boolean
  craque?: string | null
  /** Temporada, para o ranking multi-temporada (melhoria 8.6). */
  season?: string
}

export interface PlayerStats {
  id: string
  name: string
  pos: PosCode | null
  games: number
  v: number
  e: number
  d: number
  pts: number
  /** Aproveitamento 0..100. */
  pct: number
  goals: number
  ownGoals: number
}

export interface RankedRow extends PlayerStats {
  rank: number
}

export interface ScorerRow {
  id: string
  name: string
  pos: PosCode | null
  goals: number
  games: number
  avg: number
  rank: number
}

export interface TenantBranding {
  name: string
  tagline?: string
  logoUrl?: string | null
  primaryColor: string
  instagramUrl?: string | null
  timezone: string
  teamNames: Record<TeamKey, string>
  /** Posicoes criadas pelo grupo, alem das cinco base. */
  positions?: PositionDef[]
  /** Cor da camisa de cada time. Ausente = branco e preto do padrao. */
  teamColors?: Record<TeamKey, string>
}

export interface Tenant {
  id: string
  slug: string
  branding: TenantBranding
}

export type PlanCode = 'free' | 'galera' | 'time' | 'liga' | 'lifetime'
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'expired'
  | 'canceled'
  | 'over_limit'

/**
 * Como o grupo paga:
 * - `trial`: 3 meses gratis, cartao ja vinculado, nada cobrado ainda
 * - `recurring`: o cartao vinculado passa a ser cobrado todo mes
 * - `prepaid`: sem cobranca automatica, o grupo compra blocos de 30 dias
 * - `lifetime`: vitalicio, nao expira (so o backend cria)
 */
export type BillingMode = 'trial' | 'recurring' | 'prepaid' | 'lifetime'

export interface Plan {
  code: PlanCode
  name: string
  priceCents: number
  /** null = ilimitado. */
  maxPlayers: number | null
  isPublic: boolean
}

export interface Subscription {
  tenantId: string
  planCode: PlanCode
  status: SubscriptionStatus
  billingMode: BillingMode
  /** Cartao vinculado. O teste de 3 meses so comeca com cartao na conta. */
  paymentMethodOnFile: boolean
  /** Fim do teste gratis. */
  trialEndsAt?: string | null
  /** Fim do acesso pago: proxima renovacao, ou fim do credito comprado. */
  currentPeriodEnd?: string | null
}

export type Role = 'owner' | 'admin' | 'player' | 'viewer'

/** Estado da base local de um tenant. */
export interface TenantData {
  tenant: Tenant
  players: Player[]
  matches: Match[]
  subscription: Subscription
  /**
   * Papel do usuario logado neste tenant, vindo de `memberships`. So o adapter
   * que tem conta preenche: no modo local o papel continua sendo o toggle de
   * demonstracao. Papel nunca sai do front (erro 3 do docs/06-seguranca.md).
   */
  role?: Role
}
