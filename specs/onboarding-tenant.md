# Onboarding de tenant em 3 passos

Rodada 4 do loop · 2026-09-08

## 1. Escopo

Deixar o usuário autenticado **criar o próprio grupo pelo app**, sem SQL no painel: nome e cor →
colar a lista de jogadores → cair no primeiro sorteio. A primeira `membership` (papel `owner`) nasce
junto com o grupo, numa função `security definer`, porque pela RLS isso é impossível a partir do
cliente.

## 2. Fora de escopo

- **Convidar outras pessoas para o grupo.** Depende de envio de e-mail, que é o mesmo bloqueio de
  custo levantado em `specs/auth-real.md` seção 8. Enquanto isso, membro adicional continua entrando
  por SQL (`docs/10-operacao.md`).
- **Escudo do grupo** (upload de logo). A spec mestre cita "nome do grupo + escudo", mas foto ainda
  é dataURL em `localStorage` e o Storage por tenant não existe (`docs/06-seguranca.md`,
  pendências). Nesta rodada o passo 1 tem nome, tagline e cor — o escudo entra com o Storage.
- **Autocadastro de conta.** Continua sendo o painel do Supabase; quem cria grupo é quem já tem
  conta.
- Gateway, magic link, e a carga do portal antigo (segue parada por falta do dump).
- **Nenhum arquivo que está em edição fora desta rodada**: `src/App.tsx`, `src/ui/SemGrupo.tsx`,
  `src/ui/components/LineupView.tsx`, `src/ui/tabs/Regras.tsx`, `supabase/demo-*.sql`. A rodada se
  liga ao app por rota própria e pelo `Login.tsx`, que é arquivo desta linha de trabalho.

## 3. Origem e decisões que este item honra

- `docs/futebol-da-galera-spec.md`, melhoria 10: "Onboarding do tenant em 3 passos: nome do grupo +
  escudo → colar lista de jogadores → primeiro sorteio. Tempo até o primeiro valor abaixo de 3
  minutos."
- `docs/11-roadmap.md`, Fase 4 item 4.
- `supabase/demo-account.sql` (trabalho paralelo) documenta o bloqueio que este item resolve: "a
  primeira membership de um tenant NÃO pode ser criada pelo app... só o service role quebra esse
  círculo".
- ADR-002: o grupo novo nasce isolado por `tenant_id`, com RLS valendo desde a primeira linha.
- `docs/06-seguranca.md`: papel vem de `memberships`, nunca do front.

## 4. Arquivos afetados

Criados:
- `supabase/migrations/0005_onboarding.sql` — RPC `create_tenant`
- `src/domain/slug.ts` — slug a partir do nome, e validação (puro)
- `src/data/onboarding.ts` — chama a RPC e lista os grupos do usuário
- `src/ui/Onboarding.tsx` — o assistente de 3 passos
- `src/tests/slug.test.ts` — teste das funções puras

Modificados:
- `src/main.tsx` — rota `/novo`
- `src/ui/Login.tsx` — entrada para criar grupo

## 5. Critérios de aceite

1. `npm test` verde com os testes novos, e `npm run build` limpo.
2. A criação do grupo passa por RPC `security definer`, porque `tenants` **não tem policy de
   insert** e `memberships` exige `is_admin` — que lê `memberships`. Sem a função, o cliente não tem
   caminho nenhum.
3. A RPC recusa chamada sem sessão (`auth.uid()` nulo) com erro, nunca criando grupo órfão.
4. A RPC cria, na mesma transação, `tenants` + `subscriptions` + `memberships` com papel `owner`
   para quem chamou. Se qualquer parte falhar, nada é criado.
5. Slug é derivado do nome, normalizado (minúsculo, sem acento, hífens) e validado contra um formato
   fixo. Slug já em uso vira erro tratado, com sugestão, e não um estouro cru de constraint.
6. O passo 2 **reusa** `parseRosterText` de `src/domain/roster.ts` — nada de segundo parser de lista.
7. **Limite do plano é respeitado no meio da lista**: o grupo nasce no plano `free`, que permite 12
   jogadores. Colar 20 nomes cria os 12 primeiros e mostra quais ficaram de fora e por quê, com o
   caminho de upgrade — nunca falha em silêncio nem cria pela metade sem avisar.
8. Nomes repetidos na lista colada não viram jogador duplicado.
9. As funções de slug são puras (sem rede, DOM ou `localStorage`) e têm teste.
10. O assistente não deixa avançar com nome vazio, e submit duplo não cria dois grupos.
11. Sem `VITE_SUPABASE_URL` a rota de onboarding explica que ela só existe no modo Supabase, em vez
    de quebrar — o modo local não tem conta nem `memberships`.
12. Nenhum segredo no código: `grep -r "sb_publishable\|sbp_\|xqqxfmcw" src/` volta vazio.
13. Nenhum `console.log` esquecido, nenhum `TODO` sem justificativa.
14. **A RPC é exercitada contra o banco de verdade**, incluindo o caminho sem sessão e o de slug
    repetido, e o que for criado no ensaio é apagado no fim.
15. Nenhum dos arquivos listados em "fora de escopo" é modificado.

## 6. Edge cases conhecidos

- **Sem sessão**: a RPC precisa recusar; a tela precisa pedir login antes.
- **Slug já em uso** (`demo` já existe): erro legível com sugestão, não `23505` cru.
- **Nome que vira slug vazio** (só emoji, só símbolos): precisa de caminho alternativo.
- **Lista colada maior que o plano**: ver critério 7.
- **Lista com numeração, bullets e sufixo de posição** — já resolvido por `parseRosterText`.
- **Lista vazia**: o grupo é criado mesmo assim; o passo 2 pode ser pulado.
- **Usuário que já tem grupo** criando outro: permitido, mas com um teto para não virar vetor de
  abuso quando o autocadastro existir. O número escolhido está na migration e é fácil de mudar.

## 7. Definição de "aprovado sem ressalvas"

Os 15 critérios em sim, `npm test` verde, `npm run build` limpo, o ensaio da RPC contra o banco
batendo e limpo no fim, sem TODO pendente e sem tocar em arquivo de outra linha de trabalho.

---

## Resultado da review (rodada 4, 2026-09-08)

**Aprovado sem ressalvas.** 15 de 15 criterios em "sim". `npm test` verde (178 testes, 12 arquivos),
`npm run build` limpo.

A `create_tenant` foi exercitada contra o banco de verdade, simulando sessao com
`set_config('request.jwt.claims', ...)`:

| caminho | resultado |
|---|---|
| sem sessao | `28000 auth_required` |
| slug invalido (`Slug Invalido!`) | `22023 slug_invalido` |
| slug ja em uso (`demo`) | `23505 slug_em_uso` |
| nome vazio | `22023 nome_vazio` |
| cor fora de `#rrggbb` | `22023 cor_invalida` |
| caminho feliz | tenant + assinatura `free`/`trial`/sem cartao + membership **owner**, na mesma transacao |

O tenant do ensaio foi apagado no fim: o banco voltou a 1 tenant e 1 membership.

Correcao pequena durante a review: `React.ReactNode` trocado por `import type { ReactNode }`, que e
a convencao do resto do projeto (`src/ui/components/ui.tsx`).

Nada nos arquivos de outra linha de trabalho foi tocado (`src/App.tsx`, `src/ui/SemGrupo.tsx`,
`src/ui/components/LineupView.tsx`, `src/ui/tabs/Regras.tsx`, `supabase/demo-*.sql`).

**Limite de verificacao:** o assistente nao foi clicado em navegador. O caminho do limite de plano
(criterio 7) esta coberto por evidencia de codigo — `assertCanAddPlayer` roda fora de try/catch em
`SupabaseRepository.createPlayer`, entao o `PlanLimitError` chega inteiro na tela, com `limit` e
`current`.

## O que ficou de fora, e por que

- **Escudo do grupo**: a spec mestre pede "nome do grupo + escudo" no passo 1. Foto ainda e dataURL
  em `localStorage` e nao existe Storage por tenant (`docs/06-seguranca.md`, pendencias). Entra
  junto com o Storage.
- **Convite de membro**: depende de e-mail, mesmo bloqueio de custo de `specs/auth-real.md` secao 8.
- **O gancho na tela de "sem grupo"**: hoje o assistente e alcancado por `#/novo` e pelo link no
  login. Ligar tambem o `SemGrupo.tsx` e uma linha, mas aquele arquivo esta em outra linha de
  trabalho e nao foi tocado de proposito.
