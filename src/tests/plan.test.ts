import { describe, expect, it } from 'vitest'
import { PERIOD_DAYS, TRIAL_DAYS } from '../domain/constants'
import {
  BillingError,
  PlanLimitError,
  accessMode,
  activateRecurring,
  assertCanAddPlayer,
  buyPeriod,
  cancelRecurring,
  daysLeft,
  grantLifetime,
  publicPlans,
  startTrial,
} from '../domain/plan'
import type { Player, Subscription } from '../domain/types'

const DAY = 86_400_000
const T0 = new Date('2026-01-01T12:00:00Z')
const players = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, tenantId: 't', name: `P${i}`, pos: 'MC' }))

describe('teste gratis de 3 meses', () => {
  it('exige cartao vinculado', () => {
    expect(() => startTrial('t', 'galera', false)).toThrow(BillingError)
  })

  it('dura 90 dias a partir do vinculo', () => {
    const sub = startTrial('t', 'galera', true, T0)
    expect(daysLeft(sub, T0)).toBe(TRIAL_DAYS)
    expect(sub.status).toBe('trialing')
    expect(sub.billingMode).toBe('trial')
  })

  it('sem cartao, o grupo fica em somente leitura', () => {
    const sub: Subscription = {
      tenantId: 't', planCode: 'free', status: 'trialing', billingMode: 'trial',
      paymentMethodOnFile: false, trialEndsAt: null, currentPeriodEnd: null,
    }
    expect(accessMode(sub, [], T0)).toBe('read_only')
  })

  it('vencido, cai em somente leitura sem apagar nada', () => {
    const sub = startTrial('t', 'galera', true, T0)
    const depois = new Date(T0.getTime() + (TRIAL_DAYS + 1) * DAY)
    expect(accessMode(sub, players(3), depois)).toBe('read_only')
  })
})

describe('caminho 1: cobranca recorrente', () => {
  it('comeca onde o teste termina, nao no dia do clique', () => {
    const trial = startTrial('t', 'time', true, T0)
    const rec = activateRecurring(trial, new Date(T0.getTime() + 10 * DAY))
    expect(rec.billingMode).toBe('recurring')
    expect(rec.status).toBe('active')
    expect(daysLeft(rec, T0)).toBe(TRIAL_DAYS + PERIOD_DAYS)
  })

  it('nao ativa sem cartao', () => {
    const sub = { ...startTrial('t', 'time', true, T0), paymentMethodOnFile: false }
    expect(() => activateRecurring(sub, T0)).toThrow(BillingError)
  })

  it('tem 7 dias de graca quando a cobranca falha', () => {
    const rec = activateRecurring(startTrial('t', 'time', true, T0), T0)
    const fim = Date.parse(rec.currentPeriodEnd!)
    expect(accessMode(rec, players(3), new Date(fim + 5 * DAY))).toBe('full')
    expect(accessMode(rec, players(3), new Date(fim + 8 * DAY))).toBe('read_only')
  })
})

describe('caminho 2: comprar 30 dias', () => {
  it('adiciona um bloco de 30 dias e nao liga a recorrencia', () => {
    const trial = startTrial('t', 'galera', true, T0)
    const pago = buyPeriod(trial, 'galera', new Date(T0.getTime() + TRIAL_DAYS * DAY))
    expect(pago.billingMode).toBe('prepaid')
    expect(daysLeft(pago, new Date(T0.getTime() + TRIAL_DAYS * DAY))).toBe(PERIOD_DAYS)
  })

  it('comprar antes de vencer empilha o tempo, nao queima', () => {
    const trial = startTrial('t', 'galera', true, T0)
    const pago = buyPeriod(trial, 'galera', T0) // compra no primeiro dia do teste
    expect(daysLeft(pago, T0)).toBe(TRIAL_DAYS + PERIOD_DAYS)
  })

  it('nao tem graca: o tempo acaba na data', () => {
    const pago = buyPeriod(startTrial('t', 'galera', true, T0), 'galera', T0)
    const fim = Date.parse(pago.currentPeriodEnd!)
    expect(accessMode(pago, players(3), new Date(fim + 1 * DAY))).toBe('read_only')
  })

  it('nao vende vitalicio por periodo', () => {
    expect(() => buyPeriod(startTrial('t', 'galera', true, T0), 'lifetime', T0)).toThrow(BillingError)
  })
})

describe('cancelar recorrencia', () => {
  it('mantem o tempo ja pago ate o fim', () => {
    const rec = activateRecurring(startTrial('t', 'time', true, T0), T0)
    const cancelado = cancelRecurring(rec)
    expect(cancelado.billingMode).toBe('prepaid')
    expect(cancelado.currentPeriodEnd).toBe(rec.currentPeriodEnd)
  })
})

describe('limites do plano', () => {
  it('bloqueia com 402 e payload de upgrade', () => {
    const sub = startTrial('t', 'galera', true, T0) // limite 12
    try {
      assertCanAddPlayer(sub, players(12))
      throw new Error('deveria ter bloqueado')
    } catch (e) {
      expect(e).toBeInstanceOf(PlanLimitError)
      const err = e as PlanLimitError
      expect(err.status).toBe(402)
      expect(err.payload).toMatchObject({ error: 'plan_limit', limit: 12, current: 12 })
      expect(err.payload.upgrade_url).toBeTruthy()
    }
  })

  it('libera abaixo do limite e no plano ilimitado', () => {
    expect(() => assertCanAddPlayer(startTrial('t', 'galera', true, T0), players(11))).not.toThrow()
    expect(() => assertCanAddPlayer(startTrial('t', 'liga', true, T0), players(999))).not.toThrow()
  })

  it('downgrade vira over_limit, nunca apaga jogador', () => {
    const sub = { ...startTrial('t', 'galera', true, T0), planCode: 'galera' as const }
    expect(accessMode(sub, players(20), T0)).toBe('over_limit')
  })
})

describe('vitalicio', () => {
  it('nunca expira', () => {
    const life = grantLifetime(startTrial('t', 'liga', true, T0))
    expect(daysLeft(life, new Date('2099-01-01'))).toBeNull()
    expect(accessMode(life, players(500), new Date('2099-01-01'))).toBe('full')
  })

  it('nunca aparece no checkout publico', () => {
    expect(publicPlans().map((p) => p.code)).not.toContain('lifetime')
  })
})
