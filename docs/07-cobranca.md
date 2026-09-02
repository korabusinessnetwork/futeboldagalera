# 07 · Cobrança

## O fluxo

1. **Cadastro**: o grupo vincula um cartão. Nada é cobrado.
2. **Teste grátis de 3 meses** (`TRIAL_DAYS = 90`), com o cartão já na conta.
   Sem cartão vinculado o tenant fica em somente leitura — o teste não começa.
3. **No fim do teste, dois caminhos**, escolha do dono:
   - **Recorrência**: liga a cobrança mensal naquele mesmo cartão.
     `billing_mode = 'recurring'`.
   - **Tempo avulso**: não liga nada e compra blocos de **30 dias**
     (`PERIOD_DAYS = 30`) quando quiser, pelo preço do plano.
     `billing_mode = 'prepaid'`.

Comprar antes de vencer **empilha**: o bloco novo começa onde o anterior
termina, nunca queima tempo pago.

## Planos

| Plano | Preço | Jogadores ativos | Visível no checkout |
|---|---|---|---|
| Entrada | R$ 0 | 12 | sim |
| Galera | R$ 19,90 | 12 | sim |
| Time | R$ 39,90 | 24 | sim |
| Liga | R$ 69,90 | ilimitado | sim |
| Vitalício | definido na venda | ilimitado | **não, só backend** |

O preço vale tanto para o mês da recorrência quanto para o bloco de 30 dias.

## Enforcement

- O limite conta **jogadores ativos** (`deleted_at IS NULL`). Avulsos de sorteio
  são efêmeros e **não contam**.
- Estourou o limite: `POST /players` responde **402** com
  `{ error: "plan_limit", limit, current, upgrade_url }`.
- **Downgrade nunca apaga jogador.** Entra em `over_limit`: leitura liberada,
  cadastro de novo jogador bloqueado até voltar ao limite ou subir de plano.
- **Tempo esgotado**: modo somente leitura. Dados nunca são apagados
  automaticamente.
- **Graça de 7 dias** só para quem está na recorrência — ali existe uma cobrança
  a reprocessar. Quem comprou tempo avulso já sabia a data do fim, e perde a
  escrita na data.

## Provedor

Stripe para o cartão (SetupIntent no cadastro, assinatura na recorrência).
Para a compra avulsa, avaliar Pix — é forte para o público de várzea, e casa
bem com o modelo de bloco de 30 dias. Ver `adr/003-gateway-de-pagamento.md`.

O domínio inteiro (`src/domain/plan.ts`) está pronto e testado; o que falta é
plugar o gateway.
