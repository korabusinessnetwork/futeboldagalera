# ADR-003 · Gateway de pagamento

**Status**: proposto · **Data**: 2026-09-02

## Contexto

Dois momentos de cobrança, com exigências diferentes:

1. **Vincular cartão sem cobrar**, no cadastro, para liberar os 3 meses de teste.
2. **Depois do teste**: ou assinatura recorrente no mesmo cartão, ou compra
   avulsa de blocos de 30 dias.

O público é organizador de pelada no Brasil. Pix é o meio de pagamento natural
para a compra avulsa; cartão é o natural para a recorrência.

## Decisão

**Stripe** para o cartão: `SetupIntent` no cadastro (salva o cartão sem cobrar),
`Subscription` na recorrência, `PaymentIntent` avulso para o bloco de 30 dias.
Webhook em Edge Function atualiza `subscriptions` e grava `billing_periods`.

**Pix a avaliar** (Asaas ou Pagar.me) para a compra avulsa, como segundo
provedor. O campo `billing_periods.provider` já existe para isso.

## Por que não decidir o Pix agora

Não temos volume para negociar taxa, e a compra avulsa só passa a existir depois
que o primeiro teste de 3 meses vencer. Decidir antes de ter o dado é chutar.

## Consequências

- O domínio de cobrança (`src/domain/plan.ts`) não conhece provedor nenhum:
  fala em modo, plano e data. Trocar ou somar gateway não encosta na regra.
- `subscriptions.stripe_subscription_id` só é preenchido no modo `recurring`.
  No `prepaid` fica nulo por definição.
- Escrita em `subscriptions` e `billing_periods` é exclusiva do service role.
