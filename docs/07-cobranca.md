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

### Tabela nova — a valer quando o Asaas entrar

Decidido em 08/09/2026. **Ainda não está no código**: `PLANOS` em
`src/domain/constants.ts` continua com a tabela antiga logo abaixo, e a troca
acontece junto com a entrada do gateway.

| Plano | Preço | Jogadores inclusos | Jogador adicional |
|---|---|---|---|
| Grátis | R$ 0 | 6 | R$ 2,00 cada |
| Intermediário | R$ 29,90 | 16 | R$ 2,00 cada |
| Completo | R$ 69,90 | 24 | R$ 2,00 cada |
| Vitalício | definido na venda | ilimitado | — |

O **adicional de R$ 2,00 por jogador** vale em qualquer plano, inclusive no
grátis: quem passa do limite incluso paga por cabeça em vez de ser barrado.

**Isso muda o enforcement.** Hoje estourar o limite é um bloqueio
(402 `plan_limit`, ver seção abaixo); com o adicional, passar do limite é uma
cobrança. Antes de implementar, ficam em aberto:

- No grátis, um adicional pago exige cartão/Pix vinculado — o que hoje é o
  gatilho do teste de 3 meses. Definir se o grátis com adicional é um quarto
  modo de cobrança ou um plano pago disfarçado.
- Se a cobrança do adicional é proporcional no mês em que o jogador entra, ou
  cheia; e o que acontece quando ele é removido no meio do ciclo.
- No modo `prepaid` (bloco de 30 dias) o adicional precisa ser cobrado junto
  do bloco, no ato — não existe fatura mensal ali para pendurar.
- Se `over_limit` deixa de existir ou passa a valer só para quem não tem meio
  de pagamento vinculado.

### Tabela antiga — o que está no código hoje

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

**Asaas** é o gateway escolhido (decisão de 08/09/2026), no lugar do Stripe que
o `adr/003-gateway-de-pagamento.md` propunha — ele cobre cartão e Pix no mesmo
provedor, que era o motivo de o ADR deixar o Pix em aberto. O ADR precisa ser
revisado quando a integração começar.

Para a compra avulsa, Pix é o meio natural do público de várzea, e casa bem com
o modelo de bloco de 30 dias.

O domínio inteiro (`src/domain/plan.ts`) está pronto e testado; o que falta é
plugar o gateway.
