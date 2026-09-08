import {
  activateRecurring,
  assertCanAddPlayer,
  buyPeriod,
  cancelRecurring,
  startTrial,
} from '../domain/plan'
import type {
  Lineup,
  Match,
  MatchEntry,
  Player,
  PlanCode,
  Pos,
  Subscription,
  Tenant,
  TenantBranding,
  TenantData,
  VoteState,
} from '../domain/types'
import { tenantDataFromLegacy, type LegacyDump } from './legacy'
import { RepoError, uid, type Repository } from './repo'
import { defaultTenant, demoSubscription, pendingSubscription } from './tenant'

const KEY = (slug: string) => `fdg_v1_${slug}`

/**
 * Adapter local (localStorage). Roda o app inteiro sem backend, e e o que
 * carrega o seed de exemplo. As escritas continuam granulares: o snapshot so
 * e serializado depois da mutacao pontual, nunca substituindo o estado por um
 * documento recebido de fora.
 */
export class LocalRepository implements Repository {
  readonly kind = 'local' as const
  private data: TenantData

  constructor(private readonly seed: LegacyDump | null = null) {
    this.data = {
      tenant: defaultTenant(),
      players: [],
      matches: [],
      subscription: pendingSubscription('demo'),
    }
  }

  async load(slug: string): Promise<TenantData> {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY(slug)) : null
    if (raw) {
      try {
        this.data = JSON.parse(raw) as TenantData
        return this.snapshot()
      } catch {
        // snapshot corrompido: cai no seed em vez de travar o app
      }
    }
    this.data = this.seed
      ? tenantDataFromLegacy(this.seed)
      : {
          tenant: defaultTenant(),
          players: [],
          matches: [],
          subscription: pendingSubscription('demo'),
        }
    this.data.tenant.slug = slug
    // o seed de exemplo tem 36 jogadores, entao o demo nasce no plano Liga com
    // o cartao ja vinculado e os 3 meses de teste correndo
    this.data.subscription = demoSubscription(this.data.tenant.id)
    this.persist()
    return this.snapshot()
  }

  private persist() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(KEY(this.data.tenant.slug), JSON.stringify(this.data))
  }

  private snapshot(): TenantData {
    return JSON.parse(JSON.stringify(this.data)) as TenantData
  }

  private match(id: string): Match {
    const m = this.data.matches.find((x) => x.id === id)
    if (!m) throw new RepoError('Partida nao encontrada.', 'not_found')
    return m
  }

  async updateBranding(patch: Partial<TenantBranding>): Promise<Tenant> {
    this.data.tenant.branding = { ...this.data.tenant.branding, ...patch }
    this.persist()
    return JSON.parse(JSON.stringify(this.data.tenant))
  }

  async createPlayer(input: { name: string; pos: Pos | null }): Promise<Player> {
    const name = input.name.trim().slice(0, 30)
    if (!name) throw new RepoError('Informe o nome do jogador.', 'invalid')
    const dup = this.data.players.find(
      (p) => !p.deletedAt && p.name.toLowerCase() === name.toLowerCase(),
    )
    if (dup) throw new RepoError('Ja existe um jogador com esse nome.', 'duplicate')
    assertCanAddPlayer(this.data.subscription, this.data.players)

    const player: Player = {
      id: uid(),
      tenantId: this.data.tenant.id,
      name,
      pos: input.pos,
      photoUrl: null,
      isMonthly: true,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    }
    this.data.players.push(player)
    this.persist()
    return { ...player }
  }

  async updatePlayer(id: string, patch: Partial<Player>): Promise<Player> {
    const p = this.data.players.find((x) => x.id === id)
    if (!p) throw new RepoError('Jogador nao encontrado.', 'not_found')
    if (patch.name !== undefined) p.name = String(patch.name).trim().slice(0, 30)
    if (patch.pos !== undefined) p.pos = patch.pos
    if (patch.photoUrl !== undefined) p.photoUrl = patch.photoUrl
    this.persist()
    return { ...p }
  }

  async deletePlayer(id: string): Promise<void> {
    const used = this.data.matches.some((m) => m.entries.some((e) => e.playerId === id))
    if (used) {
      throw new RepoError('Jogador ja tem partidas registradas e nao pode ser excluido.', 'in_use')
    }
    const p = this.data.players.find((x) => x.id === id)
    if (!p) throw new RepoError('Jogador nao encontrado.', 'not_found')
    p.deletedAt = new Date().toISOString() // soft delete: dado nunca some
    this.persist()
  }

  async createMatch(input: {
    date: string
    entries?: MatchEntry[]
    scoreBranco?: number | null
    scorePreto?: number | null
    lineup?: Lineup | null
    pending?: boolean
    escalaPub?: boolean
  }): Promise<Match> {
    const m: Match = {
      id: uid(),
      tenantId: this.data.tenant.id,
      date: input.date,
      pending: input.pending ?? false,
      scoreBranco: input.scoreBranco ?? null,
      scorePreto: input.scorePreto ?? null,
      escalaPub: input.escalaPub ?? false,
      entries: input.entries ?? [],
      lineup: input.lineup ?? null,
      votes: {},
      craque: null,
      season: input.date.slice(0, 4),
    }
    this.data.matches.push(m)
    this.data.matches.sort((a, b) => a.date.localeCompare(b.date))
    this.persist()
    return { ...m }
  }

  async updateMatch(id: string, patch: Partial<Match>): Promise<Match> {
    const m = this.match(id)
    const fields = ['date', 'entries', 'scoreBranco', 'scorePreto', 'pending', 'escalaPub', 'lineup'] as const
    for (const k of fields) {
      if (patch[k] !== undefined) Object.assign(m, { [k]: patch[k] })
    }
    if (patch.date) m.season = patch.date.slice(0, 4)
    this.data.matches.sort((a, b) => a.date.localeCompare(b.date))
    this.persist()
    return { ...m }
  }

  async deleteMatch(id: string): Promise<void> {
    this.data.matches = this.data.matches.filter((m) => m.id !== id)
    this.persist()
  }

  async publishLineup(id: string, published: boolean): Promise<Match> {
    const m = this.match(id)
    m.escalaPub = published
    this.persist()
    return { ...m }
  }

  async setVoteState(id: string, state: VoteState): Promise<Match> {
    const m = this.match(id)
    m.voteOpen = state === 'open' ? true : undefined
    // O carimbo e o que faz a votacao aberta na mao fechar sozinha em 30 min.
    m.voteOpenedAt = state === 'open' ? new Date().toISOString() : undefined
    m.voteClosed = state === 'closed' ? true : undefined
    this.persist()
    return { ...m }
  }

  async setCraque(id: string, playerId: string | null): Promise<Match> {
    const m = this.match(id)
    m.craque = playerId
    this.persist()
    return { ...m }
  }

  async vote(matchId: string, playerId: string, voterKey: string): Promise<Record<string, number>> {
    const m = this.match(matchId)
    const ledger = ((m as Match & { voters?: Record<string, string> }).voters ??= {})
    if (ledger[voterKey]) throw new RepoError('Voce ja votou nesta partida.', 'already_voted')
    ledger[voterKey] = playerId
    m.votes = { ...(m.votes ?? {}) }
    m.votes[playerId] = (m.votes[playerId] ?? 0) + 1
    this.persist()
    return { ...m.votes }
  }

  private saveSub(sub: Subscription): Subscription {
    this.data.subscription = sub
    this.persist()
    return { ...sub }
  }

  async setPaymentMethod(onFile: boolean): Promise<Subscription> {
    const sub = this.data.subscription
    if (!onFile) return this.saveSub({ ...sub, paymentMethodOnFile: false })
    // vincular o cartao e o que dispara os 3 meses de teste
    if (sub.billingMode === 'trial' && !sub.trialEndsAt) {
      return this.saveSub(startTrial(sub.tenantId, sub.planCode, true))
    }
    return this.saveSub({ ...sub, paymentMethodOnFile: true })
  }

  async setPlan(code: PlanCode): Promise<Subscription> {
    return this.saveSub({ ...this.data.subscription, planCode: code })
  }

  async activateRecurring(): Promise<Subscription> {
    return this.saveSub(activateRecurring(this.data.subscription))
  }

  async buyPeriod(code?: PlanCode): Promise<Subscription> {
    return this.saveSub(buyPeriod(this.data.subscription, code ?? this.data.subscription.planCode))
  }

  async cancelRecurring(): Promise<Subscription> {
    return this.saveSub(cancelRecurring(this.data.subscription))
  }

  async replaceAll(data: { players: Player[]; matches: Match[] }): Promise<TenantData> {
    this.data.players = data.players
    this.data.matches = data.matches
    this.persist()
    return this.snapshot()
  }
}
