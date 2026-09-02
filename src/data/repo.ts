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

/**
 * Porta de persistencia.
 *
 * Regra da secao 7 da spec: NENHUMA escrita faz overwrite do documento inteiro.
 * Toda operacao aqui e granular. `replaceAll` existe apenas para import/reset
 * explicito do admin, que e uma acao consciente e confirmada na UI.
 */
export interface Repository {
  readonly kind: 'local' | 'supabase'

  load(slug: string): Promise<TenantData>

  updateBranding(patch: Partial<TenantBranding>): Promise<Tenant>

  createPlayer(input: { name: string; pos: Pos | null }): Promise<Player>
  updatePlayer(id: string, patch: Partial<Pick<Player, 'name' | 'pos' | 'photoUrl'>>): Promise<Player>
  /** Soft delete. Recusa quando o jogador ja aparece em alguma partida. */
  deletePlayer(id: string): Promise<void>

  createMatch(input: {
    date: string
    entries?: MatchEntry[]
    scoreBranco?: number | null
    scorePreto?: number | null
    lineup?: Lineup | null
    pending?: boolean
    escalaPub?: boolean
  }): Promise<Match>
  updateMatch(
    id: string,
    patch: Partial<
      Pick<Match, 'date' | 'entries' | 'scoreBranco' | 'scorePreto' | 'pending' | 'escalaPub' | 'lineup'>
    >,
  ): Promise<Match>
  deleteMatch(id: string): Promise<void>

  publishLineup(id: string, published: boolean): Promise<Match>
  setVoteState(id: string, state: VoteState): Promise<Match>
  setCraque(id: string, playerId: string | null): Promise<Match>
  vote(matchId: string, playerId: string, voterKey: string): Promise<Record<string, number>>

  // ---- cobranca ----
  /** Vincula ou remove o cartao. Vincular inicia os 3 meses de teste. */
  setPaymentMethod(onFile: boolean): Promise<Subscription>
  /** Troca de plano. Mantem o modo de cobranca e o tempo ja pago. */
  setPlan(code: PlanCode): Promise<Subscription>
  /** Caminho 1 ao fim do teste: ativa a cobranca recorrente no cartao. */
  activateRecurring(): Promise<Subscription>
  /** Caminho 2 ao fim do teste: compra um bloco de 30 dias. */
  buyPeriod(code?: PlanCode): Promise<Subscription>
  /** Desliga a recorrencia. O tempo ja pago continua valendo. */
  cancelRecurring(): Promise<Subscription>

  /** Import/reset explicito do admin. */
  replaceAll(data: { players: Player[]; matches: Match[] }): Promise<TenantData>
}

export class RepoError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'RepoError'
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
