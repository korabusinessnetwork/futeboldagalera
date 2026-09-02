import { GRACE_DAYS, PERIOD_DAYS, PLANOS, TRIAL_DAYS } from './constants'
import type { BillingMode, Plan, PlanCode, Player, Subscription } from './types'

/**
 * Cobranca do Futebol da Galera.
 *
 * Fluxo: o grupo vincula um cartao no cadastro e ganha 3 MESES gratis. Quando
 * o teste acaba, o dono escolhe um dos dois caminhos:
 *   1. ativar a cobranca recorrente naquele mesmo cartao, ou
 *   2. nao ativar nada e comprar tempo de uso em blocos de 30 dias, ao mesmo
 *      preco do plano.
 * Em nenhum dos dois casos algum dado e apagado quando o tempo acaba.
 */

const DAY = 86_400_000

export function planOf(code: PlanCode): Plan {
  return PLANOS.find((p) => p.code === code) ?? PLANOS[0]
}

/** O vitalicio existe so no backend, nunca aparece no checkout publico. */
export function publicPlans(): Plan[] {
  return PLANOS.filter((p) => p.isPublic)
}

/** Conta jogadores ativos. Avulsos de sorteio sao efemeros e nao contam. */
export function activePlayerCount(players: Player[]): number {
  return players.filter((p) => !p.deletedAt).length
}

// ---------------------------------------------------------------- ciclo de vida

export class BillingError extends Error {
  constructor(
    message: string,
    readonly code: 'no_payment_method' | 'lifetime',
  ) {
    super(message)
    this.name = 'BillingError'
  }
}

/** Comeca o teste de 3 meses. Exige cartao vinculado. */
export function startTrial(
  tenantId: string,
  planCode: PlanCode,
  paymentMethodOnFile: boolean,
  now = new Date(),
): Subscription {
  if (!paymentMethodOnFile) {
    throw new BillingError('Vincule um cartão para liberar os 3 meses de teste.', 'no_payment_method')
  }
  return {
    tenantId,
    planCode,
    status: 'trialing',
    billingMode: 'trial',
    paymentMethodOnFile: true,
    trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY).toISOString(),
    currentPeriodEnd: null,
  }
}

/** Data em que o acesso pago/gratuito termina. `null` = nao expira. */
export function accessUntil(sub: Subscription): string | null {
  if (sub.billingMode === 'lifetime' || sub.planCode === 'lifetime') return null
  if (sub.billingMode === 'trial') return sub.trialEndsAt ?? null
  return sub.currentPeriodEnd ?? null
}

export function daysLeft(sub: Subscription, now = new Date()): number | null {
  const until = accessUntil(sub)
  if (!until) return null
  return Math.ceil((Date.parse(until) - now.getTime()) / DAY)
}

/** Caminho 1: liga a cobranca recorrente no cartao ja vinculado. */
export function activateRecurring(sub: Subscription, now = new Date()): Subscription {
  if (!sub.paymentMethodOnFile) {
    throw new BillingError('Nenhum cartão vinculado para cobrar.', 'no_payment_method')
  }
  const from = Math.max(now.getTime(), Date.parse(accessUntil(sub) ?? '') || now.getTime())
  return {
    ...sub,
    billingMode: 'recurring',
    status: 'active',
    currentPeriodEnd: new Date(from + PERIOD_DAYS * DAY).toISOString(),
  }
}

/**
 * Caminho 2: compra um bloco de 30 dias, sem ligar a recorrencia.
 * Comprar antes de vencer empilha: o novo bloco comeca onde o anterior termina.
 */
export function buyPeriod(sub: Subscription, planCode = sub.planCode, now = new Date()): Subscription {
  if (planCode === 'lifetime') {
    throw new BillingError('O vitalício não é vendido por período.', 'lifetime')
  }
  const until = Date.parse(accessUntil(sub) ?? '')
  const from = Number.isFinite(until) ? Math.max(now.getTime(), until) : now.getTime()
  return {
    ...sub,
    planCode,
    billingMode: 'prepaid',
    status: 'active',
    currentPeriodEnd: new Date(from + PERIOD_DAYS * DAY).toISOString(),
  }
}

/** Cancela a recorrencia. O tempo ja pago continua valendo ate o fim. */
export function cancelRecurring(sub: Subscription): Subscription {
  return { ...sub, billingMode: 'prepaid', status: 'active' }
}

/** So o backend cria vitalicio, por endpoint interno com service role. */
export function grantLifetime(sub: Subscription): Subscription {
  return {
    ...sub,
    planCode: 'lifetime',
    billingMode: 'lifetime',
    status: 'active',
    trialEndsAt: null,
    currentPeriodEnd: null,
  }
}

// ------------------------------------------------------------------ enforcement

export interface PlanLimitPayload {
  error: 'plan_limit'
  limit: number
  current: number
  upgrade_url: string
}

export class PlanLimitError extends Error {
  readonly status = 402
  constructor(readonly payload: PlanLimitPayload) {
    super(`plan_limit: ${payload.current}/${payload.limit}`)
    this.name = 'PlanLimitError'
  }
}

export const UPGRADE_URL = '/assinatura'

/** Bloqueia a criacao de jogador quando o plano estourou. Nunca apaga ninguem. */
export function assertCanAddPlayer(sub: Subscription, players: Player[]): void {
  const limit = planOf(sub.planCode).maxPlayers
  if (limit == null) return
  const current = activePlayerCount(players)
  if (current < limit) return
  throw new PlanLimitError({ error: 'plan_limit', limit, current, upgrade_url: UPGRADE_URL })
}

export type AccessMode = 'full' | 'over_limit' | 'read_only'

/** Graca de 7 dias so para quem tem cobranca recorrente: ali existe cobranca a
 *  reprocessar. Quem comprou credito avulso ja sabia a data do fim. */
function graceMs(sub: Subscription): number {
  return sub.billingMode === 'recurring' ? GRACE_DAYS * DAY : 0
}

/**
 * Downgrade nunca apaga jogador: entra em `over_limit`, leitura liberada e
 * cadastro de novo jogador bloqueado. Tempo esgotado vira somente leitura.
 * Dados nunca sao apagados automaticamente.
 */
export function accessMode(sub: Subscription, players: Player[], now = new Date()): AccessMode {
  if (sub.status === 'canceled') return 'read_only'
  // o teste de 3 meses so vale com cartao vinculado
  if (sub.billingMode === 'trial' && !sub.paymentMethodOnFile) return 'read_only'

  const until = accessUntil(sub)
  if (until && now.getTime() > Date.parse(until) + graceMs(sub)) return 'read_only'

  const limit = planOf(sub.planCode).maxPlayers
  if (limit != null && activePlayerCount(players) > limit) return 'over_limit'
  return 'full'
}

/** Rotulo curto do estado da conta, para a UI. */
export function billingLabel(sub: Subscription, now = new Date()): string {
  if (sub.billingMode === 'lifetime') return 'Vitalício'
  const left = daysLeft(sub, now)
  const modes: Record<BillingMode, string> = {
    trial: 'Teste grátis',
    recurring: 'Assinatura ativa',
    prepaid: 'Tempo comprado',
    lifetime: 'Vitalício',
  }
  const base = modes[sub.billingMode]
  if (left == null) return base
  if (left < 0) return `${base} · vencido há ${Math.abs(left)} dias`
  return `${base} · ${left} ${left === 1 ? 'dia restante' : 'dias restantes'}`
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
