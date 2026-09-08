# Adapter Supabase

Rodada 1 do loop · 2026-09-08

## 1. Escopo

Implementar a porta `Repository` (`src/data/repo.ts`) contra o Postgres do projeto
`xqqxfmcwamcpyrheofcb`, com o `store` escolhendo o adapter por variavel de ambiente e caindo no
`LocalRepository` quando o Supabase nao esta configurado. Inclui as funcoes puras de mapeamento
linha<->dominio (com teste), as adicoes de schema que o adapter exige, e a row inicial de
`tenants` + `subscriptions`.

## 2. Fora de escopo

- **Auth de verdade** (login, magic link, `memberships` no lugar do toggle local) — item 1 da Fase 4
  no `docs/11-roadmap.md`, e o ADR-004 diz que o adapter entra "sem tocar em dominio nem em UI".
  O adapter **exige** sessao para funcionar (ver secao 6); nesta rodada ele apenas falha com erro
  claro quando nao ha sessao.
- **Gateway de pagamento** — item 3 da Fase 4. As escritas de cobranca ficam recusadas pelo adapter
  (ver criterio 9), porque a RLS de `subscriptions` e `billing_periods` e leitura-apenas por decisao
  do `0001_init.sql`: escrita so pelo service role via webhook.
- Onboarding em 3 passos, realtime, sync offline do PWA, e migracao dos dados que ja estao no
  `localStorage` para o Supabase.
- Qualquer mudanca de UI ou de dominio.

## 3. Origem e decisoes que este item honra

- `docs/11-roadmap.md`, Fase 4 item 2: "Adapter Supabase: implementar a porta `Repository` contra o
  Postgres. O dominio e a UI nao mudam."
- ADR-004 (persistencia plugavel): mesma porta, dois adapters, escrita sempre granular.
- ADR-002 (multi-tenancy): todo acesso filtra por `tenant_id`, RLS ativa.
- `memory/contexto.md`, decisao 2: nenhuma escrita substitui documento inteiro.
- O projeto nao tem `docs/09_BACKLOG/` nem `memory/patterns.md`. O passo `/aprender` desta rodada
  vai gravar em `memory/` e neste spec.

## 4. Arquivos afetados

Criados:
- `src/data/supabaseClient.ts` — client a partir de `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- `src/data/supabaseMap.ts` — funcoes puras linha<->dominio
- `src/data/supabaseRepo.ts` — `SupabaseRepository implements Repository`
- `src/tests/supabaseMap.test.ts` — teste das funcoes puras
- `supabase/migrations/0003_adapter.sql` — o que o adapter precisa no schema
- `supabase/migrations/0004_seed_tenant.sql` — tenant + subscription iniciais

Modificados:
- `src/data/store.ts` — escolhe o adapter

## 5. Criterios de aceite

1. `npm run build` (tsc + vite) passa, e `npm test` fica verde com os testes novos incluidos.
2. `SupabaseRepository` implementa **todos** os membros de `Repository`, com `kind = 'supabase'`,
   sem `any` nao justificado e sem metodo lancando "nao implementado" fora dos de cobranca.
3. O client sai **so** de `import.meta.env` — nenhuma URL, chave ou ref de projeto hardcodada em
   `src/`. `grep -r "xqqxfmcwamcpyrheofcb\|sb_publishable\|supabase.co" src/` volta vazio.
4. Toda consulta lista os campos explicitamente — nenhum `select('*')` nas tabelas de dominio.
5. Toda escrita e granular: nenhum metodo envia o `TenantData` inteiro. `replaceAll` e a unica
   excecao, e continua sendo a acao consciente do admin.
6. Todo acesso e filtrado por `tenant_id` (ou pelo `match_id` do tenant), nunca confiando so na RLS.
7. Toda chamada ao Supabase trata o erro e o converte em `RepoError` com codigo utilizavel pela UI
   (`auth_required`, `not_found`, `duplicate`, `in_use`, `already_voted`, `not_supported`).
8. `load()` sem sessao autenticada falha com `RepoError('auth_required')` e mensagem legivel — nao
   retorna base vazia fingindo que deu certo.
9. Os cinco metodos de cobranca (`setPaymentMethod`, `setPlan`, `activateRecurring`, `buyPeriod`,
   `cancelRecurring`) lancam `RepoError('not_supported')` explicando que a escrita de cobranca passa
   pelo gateway, em vez de tentar um UPDATE que a RLS recusa em silencio.
10. A apuracao do craque sai de RPC `security definer` — o cliente nunca le a tabela `craque_votes`
    inteira, porque a policy so expoe o proprio voto.
11. Voto repetido do mesmo `voter_key` na mesma partida vira `RepoError('already_voted')`, apoiado
    na PK `(match_id, voter_key)` do banco, nao em checagem no cliente.
12. `deletePlayer` recusa quando o jogador tem partida, e quando aceita faz soft delete
    (`deleted_at`), igual ao `LocalRepository`.
13. As funcoes de mapeamento sao puras (nao tocam em rede, DOM ou `localStorage`) e tem teste
    cobrindo ida e volta de `Player`, `Match`/`MatchEntry`, `Tenant`/branding e `Subscription`.
14. `store.ts` usa o `SupabaseRepository` quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
    estao preenchidas, e o `LocalRepository` com o seed quando nao estao. Sem env, o comportamento
    de hoje nao muda.
15. Dinheiro continua em centavos inteiros; nenhum float entra em `billing_periods`.
16. Nenhum `console.log` esquecido, nenhum `TODO` sem justificativa escrita ao lado.

## 6. Edge cases conhecidos

- **Sem sessao a RLS devolve zero linhas.** `is_member(tenant_id)` depende de `auth.uid()`. Com a
  chave publishable e sem login, todo `select` volta vazio — indistinguivel de "grupo sem dados".
  Por isso o criterio 8.
- **Avulso nao cabe em `match_entries`.** O `Lineup` do dominio carrega jogadores efemeros com id
  `av-*`, que nao tem row em `players`; gravar isso violaria a FK `player_id`. O `lineup` vai para
  uma coluna `jsonb` em `matches` (migration 0003), com `draw_seed` mantido em sincronia para
  auditoria. Desvio consciente do desenho normalizado do `0001_init.sql`.
- **Branding sem coluna.** `teamColors` e `positions` existem em `TenantBranding` e nao tem coluna
  em `tenants`. A migration 0003 adiciona as duas como `jsonb`.
- **`team` diverge.** O dominio usa `branco`/`preto`; o banco usa `a`/`b`. A traducao fica isolada
  no mapeamento e coberta por teste.
- **`votes` e derivado.** `Match.votes` e um `Record<playerId, count>` que no banco so existe como
  agregacao de `craque_votes`.
- **Partida sem escalacao, sem placar, ou sem jogador** — `load()` nao pode quebrar.
- **Nome duplicado de jogador** — o indice unico parcial do banco e quem decide; o erro `23505` vira
  `RepoError('duplicate')`.

## 7. Definicao de "aprovado sem ressalvas"

Todos os 16 criterios em sim, `npm test` verde, `npm run build` limpo, sem TODO pendente, sem
`console.log` esquecido, e o `LocalRepository` seguindo com o comportamento de hoje quando nao ha
variavel de ambiente.

---

## Resultado da review (rodada 1, 2026-09-08)

**Aprovado sem ressalvas.** 16 de 16 criterios em "sim". `npm test` verde (126 testes, 8 arquivos),
`npm run build` limpo.

Corrigido durante a review, sem precisar de decisao:

- **Voto seria recusado pela RLS em toda tentativa.** `Craque.tsx:75` passa `deviceKey()` (uuid do
  localStorage) e a policy `own_vote_write` exige `voter_key = auth.uid()::text`. O `vote()` do
  adapter passou a usar o id da sessao. Registrado em `memory/bugs.md`.
- Filtro redundante de avulso no `replaceAll` (o `writeEntries` ja descartava) e um `?? ''` morto no
  `slugOf`.

Falso positivo levantado e descartado: entradas de avulso nao se perdem, porque
`domain/match.ts:29` (`entriesFromLineup`) ja nao gera entrada para id `av-*`.

Verificado contra o banco vivo, alem da suite:

- 53 colunas dos `select` + 42 usadas em insert/update conferidas contra `information_schema`
- `craque_tally(p_match uuid)` e `craque_tally_tenant(p_tenant uuid)`, ambas `security definer`
- chave publishable do `.env` conecta no PostgREST; `plans` responde os 5 planos
- `players` e `tenants` voltam `[]` sem sessao — a RLS barra, como o spec previa

## O que ficou para a proxima rodada

- **Auth real** (Fase 4, item 1). Sem ela o adapter nao carrega nada: `load()` para em
  `auth_required`. Precisa de tela de login e da row em `memberships` ligando o usuario ao tenant.
- **Cobranca** (Fase 4, item 3). Os cinco metodos recusam com `not_supported` ate o gateway existir.
- A subscription semeada no `0004` nasce sem cartao, entao o grupo abre em somente leitura. Trocar
  isso e decisao do dono, nao do seed.
