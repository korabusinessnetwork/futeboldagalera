import { useState } from 'react'
import { useIsAdmin, useStore } from '../../data/store'
import { PERIOD_DAYS, TRIAL_DAYS } from '../../domain/constants'
import {
  BillingError,
  activePlayerCount,
  billingLabel,
  daysLeft,
  formatPrice,
  planOf,
  publicPlans,
} from '../../domain/plan'
import { formatDate } from '../../domain/match'
import { Banner, Section } from '../components/ui'

export default function Assinatura() {
  const data = useStore((s) => s.data!)
  const mutate = useStore((s) => s.mutate)
  const isAdmin = useIsAdmin()
  const [msg, setMsg] = useState<string | null>(null)

  const sub = data.subscription
  const current = planOf(sub.planCode)
  const used = activePlayerCount(data.players)
  const left = daysLeft(sub)
  const until = sub.billingMode === 'trial' ? sub.trialEndsAt : sub.currentPeriodEnd

  const run = (fn: () => Promise<unknown>) => async () => {
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg(e instanceof BillingError ? e.message : (e as Error).message)
    }
  }

  return (
    <Section title="Assinatura">
      {msg && <Banner tone="danger">{msg}</Banner>}

      <div className="card mb-3 px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted">{billingLabel(sub)}</div>
        <div className="text-lg font-extrabold text-accent">{current.name}</div>
        <div className="tabular text-xs text-muted">
          {used} jogadores ativos {current.maxPlayers ? `de ${current.maxPlayers}` : '· sem limite'}
          {until ? ` · até ${formatDate(until.slice(0, 10))}` : ''}
        </div>
      </div>

      {/* Cartão vinculado: é o que libera os 3 meses de teste. */}
      <div className="card mb-3 flex items-center gap-3 px-4 py-3">
        <span className="text-2xl">💳</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">
            {sub.paymentMethodOnFile ? 'Cartão vinculado' : 'Nenhum cartão vinculado'}
          </div>
          <div className="text-[11px] text-muted">
            {sub.paymentMethodOnFile
              ? 'Nada é cobrado durante o teste. A cobrança só começa se você ativar.'
              : `Vincule um cartão para liberar ${TRIAL_DAYS / 30} meses grátis. Nada é cobrado agora.`}
          </div>
        </div>
        {isAdmin && (
          <button
            className={`btn px-2 py-1 text-xs ${sub.paymentMethodOnFile ? '' : 'btn-primary'}`}
            onClick={run(() => mutate((r) => r.setPaymentMethod(!sub.paymentMethodOnFile)))}
          >
            {sub.paymentMethodOnFile ? 'Remover' : 'Vincular'}
          </button>
        )}
      </div>

      {sub.billingMode === 'trial' && sub.paymentMethodOnFile && (
        <Banner>
          Teste grátis rodando{left != null ? `, ${left} dias restantes` : ''}. Quando acabar, escolha:
          ativar a cobrança no cartão, ou comprar tempo de {PERIOD_DAYS} dias quando quiser.
        </Banner>
      )}
      {sub.billingMode === 'prepaid' && left != null && left <= 7 && (
        <Banner tone="warn">
          Seu tempo acaba em {left} {left === 1 ? 'dia' : 'dias'}. Sem renovar, o grupo entra em somente
          leitura. Nada é apagado.
        </Banner>
      )}

      {/* Os dois caminhos depois do teste. */}
      {isAdmin && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <div className="card flex flex-col gap-2 p-3">
            <div>
              <div className="text-sm font-bold">🔁 Cobrança recorrente</div>
              <div className="text-[11px] text-muted">
                {formatPrice(current.priceCents)} por mês no cartão vinculado. Cancela quando quiser.
              </div>
            </div>
            <button
              className="btn btn-primary mt-auto"
              disabled={sub.billingMode === 'recurring' || !sub.paymentMethodOnFile}
              onClick={run(() => mutate((r) => r.activateRecurring()))}
            >
              {sub.billingMode === 'recurring' ? 'Ativa' : 'Ativar'}
            </button>
            {sub.billingMode === 'recurring' && (
              <button className="btn" onClick={run(() => mutate((r) => r.cancelRecurring()))}>
                Cancelar recorrência
              </button>
            )}
          </div>

          <div className="card flex flex-col gap-2 p-3">
            <div>
              <div className="text-sm font-bold">🎟 Comprar {PERIOD_DAYS} dias</div>
              <div className="text-[11px] text-muted">
                {formatPrice(current.priceCents)} por bloco, sem cobrança automática. Comprar antes de vencer
                empilha o tempo.
              </div>
            </div>
            <button className="btn btn-primary mt-auto" onClick={run(() => mutate((r) => r.buyPeriod()))}>
              Comprar {PERIOD_DAYS} dias
            </button>
          </div>
        </div>
      )}

      <span className="label">Planos</span>
      <div className="space-y-2">
        {publicPlans().map((p) => (
          <div
            key={p.code}
            className={`card flex items-center gap-3 px-4 py-3 ${p.code === current.code ? 'border-accent/60' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{p.name}</div>
              <div className="text-[11px] text-muted">
                {p.maxPlayers ? `até ${p.maxPlayers} jogadores ativos` : 'jogadores ilimitados'}
              </div>
            </div>
            <div className="text-right">
              <div className="tabular text-sm font-extrabold">
                {p.priceCents ? formatPrice(p.priceCents) : 'Grátis'}
              </div>
              <div className="text-[10px] text-muted">
                {p.priceCents ? `mês ou ${PERIOD_DAYS} dias` : 'plano de entrada'}
              </div>
            </div>
            {isAdmin && p.code !== current.code && (
              <button
                className="btn btn-primary px-2 py-1 text-xs"
                onClick={run(() => mutate((r) => r.setPlan(p.code)))}
              >
                Trocar
              </button>
            )}
          </div>
        ))}
      </div>

      <Banner>
        Checkout real (cartão via Stripe, e Pix para a compra avulsa) entra na Fase 4. Aqui a troca é local,
        para exercitar o enforcement. O plano vitalício existe só no backend e nunca aparece nesta lista.
      </Banner>

      <p className="text-[11px] leading-relaxed text-muted">
        Downgrade nunca apaga jogador: o grupo entra em <b>over_limit</b>, leitura continua liberada e o
        cadastro de novos jogadores fica bloqueado. Quem está na recorrência tem 7 dias de graça se a cobrança
        falhar; quem comprou tempo avulso perde o acesso de escrita na data, sem graça, porque não há cobrança
        a reprocessar. Em nenhum caso os dados são apagados.
      </p>
    </Section>
  )
}
