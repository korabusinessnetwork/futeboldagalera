import { PALETA_DEFAULT } from '../domain/constants'
import { startTrial } from '../domain/plan'
import type { Subscription, Tenant } from '../domain/types'

/** Tenant de demonstracao, alimentado pelo seed de exemplo. */
export function defaultTenant(): Tenant {
  return {
    id: 'demo',
    slug: 'demo',
    branding: {
      name: 'Futebol da Galera',
      tagline: 'Confusao, Cultura e Ladaia',
      logoUrl: null,
      primaryColor: PALETA_DEFAULT.accent,
      instagramUrl: null,
      timezone: 'America/Sao_Paulo',
      teamNames: { branco: 'Branco', preto: 'Preto' },
    },
  }
}

/**
 * Grupo recem-criado: sem cartao, o teste ainda nao comecou. Enquanto nao
 * vincular o cartao, o app fica em somente leitura.
 */
export function pendingSubscription(tenantId: string): Subscription {
  return {
    tenantId,
    planCode: 'free',
    status: 'trialing',
    billingMode: 'trial',
    paymentMethodOnFile: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
  }
}

/** Estado do tenant de demo: cartao ja vinculado, 3 meses de teste rodando. */
export function demoSubscription(tenantId: string): Subscription {
  return startTrial(tenantId, 'liga', true)
}
