# ADR-005 · Teste de 3 meses com cartão, depois recorrência ou blocos de 30 dias

**Status**: aceito · **Data**: 2026-09-02

## Contexto

A spec original previa trial de 14 dias sem cartão. Duas coisas mudaram a
leitura:

1. Pelada é semanal. Em 14 dias o grupo joga duas vezes — não dá tempo de o
   organizador sentir o valor do sorteio, do ranking e do craque num ciclo
   inteiro.
2. Organizador de várzea não tem cartão corporativo nem previsibilidade de
   caixa. Assinatura mensal automática assusta uma parte do público.

## Decisão

**Teste de 3 meses, com cartão vinculado no cadastro.** Nada é cobrado durante o
teste; sem cartão o teste não começa e o tenant fica em somente leitura.

**No fim do teste, o dono escolhe:**

- **Recorrência**: liga a cobrança mensal naquele cartão.
- **Tempo avulso**: compra blocos de **30 dias** quando quiser, ao mesmo preço
  do plano. Comprar antes de vencer empilha o tempo.

Graça de 7 dias só na recorrência — ali existe cobrança a reprocessar. Quem
comprou avulso já sabia a data do fim.

## Por quê

- Três meses cobrem uma temporada curta inteira: doze peladas, um ranking com
  significado, um campeão. É o tempo do hábito pegar.
- O cartão no cadastro filtra curioso e derruba o atrito da conversão: no fim do
  teste é um clique, não um novo cadastro.
- O bloco de 30 dias respeita o caixa de várzea, que é sazonal. Grupo que para
  em janeiro não paga janeiro.
- Nenhum dos dois caminhos apaga dado. Tempo vencido derruba escrita, nunca
  histórico.

## Consequências

- `subscriptions` ganha `billing_mode` (`trial`/`recurring`/`prepaid`/`lifetime`)
  e `payment_method_on_file`, com constraint garantindo que trial exige cartão.
- `billing_periods` registra cada bloco: vira extrato e auditoria de receita.
- Receita fica menos previsível que assinatura pura. É o preço de atender um
  público que não assina nada. Reavaliar quando houver 50 tenants pagantes.
