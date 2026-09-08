# Bugs encontrados e corrigidos

## 2026-09-08 · `0001_init.sql` não subia: coluna gerada com função não-IMMUTABLE

`matches.season` era `generated always as (to_char(date, 'YYYY')) stored`. O Postgres exige
`IMMUTABLE` em expressão de coluna gerada, e `to_char(date, text)` é apenas `STABLE`. O banco
recusava a migration inteira com `ERROR 42P17: generation expression is not immutable` — nenhuma
das 10 tabelas era criada.

**Causa**: `to_char` depende de `lc_time`/`DateStyle`, então não pode ser imutável.
**Correção**: `extract(year from date)::text`, que é imutável para `date`.
**Próxima vez**: coluna gerada só aceita expressão imutável. `extract`/`date_part` sobre `date` são
imutáveis; sobre `timestamptz` não são. O erro só aparece ao aplicar no banco — `tsc` e teste não
pegam.

## 2026-09-08 · `plans` sem RLS deixava o preço dos planos aberto para escrita pública

O `0001_init.sql` ligou RLS em 9 tabelas e esqueceu `plans`. No Supabase o role `anon` recebe grant
por padrão no schema `public`, então qualquer pessoa com a chave publishable — que por definição vai
no bundle do front — podia dar `UPDATE` em `plans.price_cents`.

**Correção**: `supabase/migrations/0002_plans_rls.sql` — RLS ligada, `select` liberado para todos,
escrita só pelo service role.
**Próxima vez**: no Supabase, tabela em `public` sem RLS é tabela pública para escrita, não só para
leitura. "É só tabela de referência" não é motivo para deixar sem policy.

## 2026-09-08 · Voto pelo Supabase seria recusado em 100% das tentativas

`src/ui/tabs/Craque.tsx:75` chama `vote(match.id, playerId, deviceKey())`, e `deviceKey()`
(`src/ui/craqueImage.ts:83`) devolve um uuid aleatório guardado no `localStorage`. A policy
`own_vote_write` do `0001_init.sql` é `with check (voter_key = auth.uid()::text)`: chave de aparelho
nunca bate com o id da conta, então todo insert voltaria erro de RLS.

**Correção**: `SupabaseRepository.vote()` ignora o `voterKey` recebido e usa o id da sessão. O
vínculo por conta é mais forte que por aparelho, e é o que a policy escrita já pedia.
**Próxima vez**: ao ligar um adapter novo numa porta existente, conferir cada policy contra o
**valor que a UI realmente passa** — a assinatura do método bater não garante que o dado serve.
