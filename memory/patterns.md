# Padrões do projeto

## Adapter de persistência: mapeamento puro separado do acesso

Estabelecido em `src/data/supabaseMap.ts` + `src/data/supabaseRepo.ts` (2026-09-08).

O adapter é dividido em dois arquivos:

- **`*Map.ts`** — só funções puras linha↔domínio, mais as constantes de coluna. Não importa o client,
  não toca em rede, DOM ou `localStorage`. É o pedaço testável sem banco, e é onde ficam as
  divergências entre schema e domínio (`branco`/`preto` ↔ `a`/`b`, `pending` ↔ `status`,
  `voteOpen`/`voteClosed` ↔ `vote_state`).
- **`*Repo.ts`** — só orquestração: sessão, query, tratamento de erro.

Vale para qualquer adapter novo da porta `Repository`. O teste do mapeamento (22 casos em
`src/tests/supabaseMap.test.ts`) roda sem credencial nenhuma.

## Colunas sempre explícitas, nunca `select('*')`

As listas ficam em constantes no `*Map.ts` (`TENANT_COLS`, `PLAYER_COLS`, ...), perto dos tipos de
linha que elas preenchem. Uma lista só, usada por todo mundo, evita divergência entre o `select` e a
interface `*Row`.

## Erro externo vira `RepoError` com código, nunca vaza cru

`SupabaseRepository.fail()` traduz o `PostgrestError` para os códigos que a UI já trata:
`23505`→`duplicate`, `23503`→`in_use`, `42501`/`PGRST301`→`forbidden`, `PGRST116`→`not_found`, resto
→`db_error` com a mensagem original anexada. Nenhuma chamada ao Supabase escapa sem passar por
`fail()` ou `take()`.

## Operação que a RLS não permite recusa alto e claro

Os cinco métodos de cobrança do `SupabaseRepository` lançam `RepoError('not_supported')` em vez de
tentar o `UPDATE`. Motivo: as policies de `subscriptions` e `billing_periods` são leitura-apenas
(escrita só pelo service role, no webhook do gateway). Um `UPDATE` daqui volta **sem erro e sem
gravar nada** — o pior resultado possível, porque a tela diz que salvou.

Regra geral: quando a RLS torna uma escrita impossível, o adapter recusa explicitamente. Silêncio do
PostgREST não é sucesso.

## Filtro por `tenant_id` no código, além da RLS

Toda escrita do adapter leva `.eq('tenant_id', this.tid())` mesmo com a RLS ativa. A RLS é a rede de
segurança, não o filtro — ADR-002.
