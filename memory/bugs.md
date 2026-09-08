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

## 2026-09-08 · Papel de admin sobrevivia à troca de conta e à troca de modo

Duas falhas do mesmo tipo, achadas na review da rodada 2, antes de rodar em navegador:

1. `initialRole()` lia `localStorage.fdg_role` sempre. Quem tivesse clicado no toggle de admin
   enquanto o app rodava local e depois ligasse o Supabase começava a sessão com `role: 'admin'`
   vindo do front — exatamente o erro 3 do `docs/06-seguranca.md`, por outra porta.
2. `signOut()` limpava `user` e `data` mas deixava `role` como estava. O próximo login numa conta
   `viewer` herdava o `owner` do login anterior até o `load()` terminar.

**Correção**: `initialRole()` devolve `viewer` quando `authEnabled`; `signOut()` e a queda de sessão
resetam `role` para `viewer`.
**Próxima vez**: papel é dado de sessão, não de aplicação. Toda saída de conta tem que zerar tudo
que veio da conta — e estado que mora em `localStorage` precisa de uma regra explícita para quando o
modo do app muda debaixo dele.

## 2026-09-08 · `onAuthChange` assinava duas vezes por causa do StrictMode

`main.tsx` roda em `<StrictMode>`, que invoca cada efeito duas vezes em desenvolvimento. O
`useEffect` que chama `initAuth()` criava dois assinantes de `onAuthStateChange`, e cada mudança de
sessão chegava em dobro no store.

**Correção**: trava de módulo `authIniciada` em `src/data/store.ts`.
**Próxima vez**: efeito que assina algo global precisa ou de cleanup de verdade, ou de trava de
idempotência. Em StrictMode o sintoma aparece em dev; sem ele, só em produção e mais tarde.
