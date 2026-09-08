# Auth real: e-mail/senha + memberships

Rodada 2 do loop · 2026-09-08

## 1. Escopo

Trocar o toggle local de admin por autenticacao de verdade no modo Supabase: login por e-mail e
senha, sessao persistida, logout, e o papel (`owner`/`admin`/`player`/`viewer`) vindo da tabela
`memberships` em vez do `localStorage`. Com isso o `SupabaseRepository` entregue na rodada 1 para de
morrer em `auth_required` e passa a carregar o grupo.

O adapter local nao muda: sem `VITE_SUPABASE_URL` o app segue com o toggle de demonstracao.

## 2. Fora de escopo

- **Magic link, cadastro self-service e "esqueci a senha".** Os tres dependem de entrega de e-mail, e
  o projeto esta no mailer embutido do Supabase (`smtp_host: null`, `mailer_autoconfirm: false`),
  que e limitado e nao serve para producao. Ligar isso e decisao de custo do dono — ver secao 8.
  Nesta rodada as contas sao criadas no painel do Supabase.
- **Onboarding de tenant** (Fase 4, item 4) e **convite de membros**. Enquanto nao existem, a
  primeira `membership` e criada por SQL documentado, nao por fluxo de produto: inventar quem pode
  "reivindicar" um grupo e decisao de produto, e nao esta escrita em lugar nenhum.
- Gateway de pagamento, recuperacao de conta, 2FA, provider social (Google).
- Qualquer mudanca no `LocalRepository` ou no dominio de sorteio/ranking/cobranca.

## 3. Origem e decisoes que este item honra

- `docs/11-roadmap.md`, Fase 4 item 1: "Auth real: e-mail/senha + magic link no Supabase,
  `memberships` de verdade no lugar do toggle local."
- `docs/06-seguranca.md`: "Lista de admins hardcoded no front" era o erro 3 do original; papeis vem
  de `memberships`, checados no banco. E: "O modo admin do adapter local e um toggle de
  demonstracao, sem auth."
- ADR-004: dominio nao conhece persistencia. O papel entra em `TenantData`, que ja e a fronteira.
- `specs/_loop.md`, rodada 1: este era o proximo item recomendado.

## 4. Arquivos afetados

Criados:
- `src/data/auth.ts` — sessao, login, logout, e os mapeadores puros de erro e papel
- `src/ui/Login.tsx` — tela de login
- `src/tests/auth.test.ts` — teste das funcoes puras

Modificados:
- `src/domain/types.ts` — `TenantData.role?: Role`
- `src/data/supabaseRepo.ts` — `load()` traz o papel de `memberships`
- `src/data/store.ts` — estado de sessao, papel vindo do repo
- `src/App.tsx` — porta de login e botao de sair; o toggle de admin so aparece no modo local
- `docs/10-operacao.md` — como criar a conta dona e ligar a primeira `membership`

## 5. Criterios de aceite

1. `npm test` verde com os testes novos, e `npm run build` limpo.
2. Com `VITE_SUPABASE_URL` preenchida e **sem sessao**, o app mostra a tela de login — nunca a tela
   de erro `auth_required` crua nem uma base vazia.
3. Login com e-mail e senha corretos carrega o grupo; a sessao sobrevive a um reload da pagina.
4. Logout limpa a sessao e volta para a tela de login, sem deixar dado do grupo na tela.
5. O papel vem de `memberships.role` do usuario logado. `TenantData.role` e preenchido pelo
   `SupabaseRepository` e ignorado pelo `LocalRepository`.
6. **No modo Supabase o toggle de admin nao existe.** Um botao que promove o proprio usuario a admin
   pelo `localStorage` e exatamente o erro 3 do `docs/06-seguranca.md`.
7. Sem `VITE_SUPABASE_URL` nada muda: toggle de demonstracao no lugar, sem tela de login.
8. Erro de credencial vira mensagem legivel em portugues, nunca o texto cru do Supabase e nunca
   revelando se o e-mail existe.
9. A senha nunca e logada, nunca vai para `localStorage` e nao fica em estado depois do submit.
10. Nenhum segredo novo no codigo: `grep -r "sb_publishable\|supabase.co\|sbp_" src/` volta vazio.
11. As funcoes puras novas (mapeamento de erro e de papel) tem teste, e nao tocam em rede nem DOM.
12. Nenhum `console.log` esquecido, nenhum `TODO` sem justificativa escrita ao lado.
13. `docs/10-operacao.md` traz o passo a passo de criar a conta dona no painel e o SQL da primeira
    `membership`, sem e-mail de cliente cravado em codigo ou migration (white-label).

## 6. Edge cases conhecidos

- **Usuario logado sem membership**: `load()` nao acha o tenant (a RLS esconde) e hoje devolve
  "Grupo nao encontrado ou voce nao e membro dele". Precisa continuar sendo essa mensagem, e nao uma
  tela em branco.
- **Sessao expirada no meio do uso**: a proxima escrita volta erro de sessao; o app precisa cair na
  tela de login em vez de travar.
- **Reload com sessao valida**: nao pode piscar a tela de login antes de resolver a sessao — existe
  um estado "verificando" entre os dois.
- **Submit duplo** no formulario de login, e senha ou e-mail vazios.
- **Papel `player`/`viewer`**: nao e admin, entao as abas de admin somem — o mesmo caminho que o
  `isAdmin` ja usa hoje.

## 7. Definicao de "aprovado sem ressalvas"

Os 13 criterios em sim, `npm test` verde, `npm run build` limpo, o modo local intacto, sem TODO
pendente e sem `console.log` esquecido.

## 8. Custo levantado (fora de escopo, decisao do dono)

Magic link, cadastro self-service e recuperacao de senha exigem SMTP proprio. O mailer embutido do
Supabase e explicitamente "best effort", com limite baixo por hora e sem garantia de entrega
(fonte: docs do Supabase sobre Auth SMTP, consultadas em 2026-09-08 — confirmar o limite atual antes
de decidir).

- **Alternativa gratuita**: contas criadas no painel, que e o que esta nesta rodada. Perde-se o
  autoatendimento; serve enquanto o produto tem um grupo so.
- **Pago**: Resend, Postmark ou Amazon SES. Faixa inicial costuma ter tier gratuito de alguns
  milhares de e-mails/mes, e planos pagos comecando na casa de US$10–20/mes.
- **Recomendacao**: mais pra frente. So vira bloqueio quando existir o segundo grupo, e ai o
  onboarding (Fase 4, item 4) vai precisar do e-mail de qualquer jeito — melhor decidir os dois
  juntos do que pagar por um agora.

---

## Resultado da review (rodada 2, 2026-09-08)

**Aprovado sem ressalvas.** 13 de 13 criterios em "sim". `npm test` verde (134 testes, 9 arquivos),
`npm run build` limpo.

Corrigido durante a review, sem precisar de decisao:

- **Papel sobrevivia a troca de conta e a troca de modo.** `initialRole()` lia
  `localStorage.fdg_role` mesmo no modo Supabase, e `signOut()` nao resetava o papel. Ambos viraram
  `viewer`. Registrado em `memory/bugs.md`.
- **`onAuthChange` assinava duas vezes** por causa do `<StrictMode>`. Trava de modulo no `initAuth`.

Verificado alem da suite: o SQL de bootstrap do `docs/10-operacao.md` foi rodado contra o banco com
um e-mail inexistente — parseia, o `on conflict (tenant_id, user_id)` casa com a PK, e nao inseriu
nada (0 memberships), como esperado.

**Limite desta verificacao, dito por inteiro:** o login nao foi exercitado ponta a ponta contra uma
conta real. Criar conta exige o painel do Supabase ou a chave `service_role`, que nao esta
disponivel nesta sessao. Os criterios 3 e 4 estao cobertos por evidencia de codigo
(`persistSession: true` no client, `initAuth` resolvendo a sessao guardada, `signOut` limpando
`user`/`data`/`role`), nao por execucao. O primeiro login de verdade e o passo do
`docs/10-operacao.md`.

## O que ficou para a proxima rodada

- **Magic link, autocadastro e "esqueci a senha"** — dependem de SMTP contratado. Custo e
  recomendacao na secao 8 deste spec.
- **Onboarding de tenant** (Fase 4, item 4), que e onde convite de membro e criacao de grupo passam
  a existir de verdade e o passo manual do `docs/10-operacao.md` deixa de ser necessario.
- **Gateway de pagamento** (Fase 4, item 3) — os cinco metodos de cobranca do adapter seguem
  recusando com `not_supported`.
