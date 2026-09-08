# Ledger do loop

## Rodada 2 — Auth real (e-mail/senha + memberships) — 2026-09-08

- Spec: `specs/auth-real.md`
- Resultado da review: **aprovado sem ressalvas** — 13/13 critérios, `npm test` verde (134 testes),
  `npm run build` limpo
- Corrigido pela própria review: papel de admin sobrevivia à troca de conta e à troca de modo
  (`initialRole` lia o `localStorage` mesmo no modo Supabase; `signOut` não resetava o papel);
  `onAuthChange` assinava duas vezes por causa do `<StrictMode>`
- Aprendido: `memory/bugs.md` (2 bugs), `memory/learnings.md` (2 aprendizados), resultado apendado
  em `specs/auth-real.md`
- Portão de custo: magic link, autocadastro e "esqueci a senha" exigem SMTP contratado e ficaram
  **fora de escopo**, com custo e recomendação na seção 8 de `specs/auth-real.md`. A metade
  e-mail/senha, que é grátis, destravou o adapter sozinha.
- Limite de verificação: o login não foi exercitado contra uma conta real — criar conta exige o
  painel ou a `service_role`. Critérios 3 e 4 cobertos por evidência de código.
- Commit: `1860467` na branch `claude/adapter-supabase`
- Pendente de decisão: nenhuma. Para abrir o app contra o Supabase, seguir `docs/10-operacao.md`
  (criar conta com Auto Confirm + SQL da primeira `membership`).
- Próximo item recomendado: **gateway de pagamento (Fase 4, item 3)** — é o único item que ainda
  bloqueia o produto de ser vendido, e sem ele os cinco métodos de cobrança do adapter seguem
  recusando com `not_supported`.

## Rodada 1 — Adapter Supabase — 2026-09-08

- Spec: `specs/adapter-supabase.md`
- Resultado da review: **aprovado sem ressalvas** — 16/16 critérios, `npm test` verde (126 testes),
  `npm run build` limpo
- Corrigido pela própria review: `vote()` usava a chave de aparelho, que a policy `own_vote_write`
  recusaria em 100% das tentativas; filtro redundante de avulso no `replaceAll`; `?? ''` morto no
  `slugOf`
- Aprendido: `memory/bugs.md` (3 bugs), `memory/learnings.md` (4 aprendizados),
  `memory/patterns.md` (5 padrões de adapter), resultado apendado em `specs/adapter-supabase.md`
- Banco: migrations 0001–0004 aplicadas no projeto `xqqxfmcwamcpyrheofcb`, 10 tabelas, RLS em todas,
  2 RPCs `security definer`, tenant `demo` semeado
- Commit: `643cd45` na branch `claude/adapter-supabase`, commit único por decisão do dono.
- Pendente de decisão: nenhuma. Ficou registrado que este commit **mistura dois trabalhos**: o
  adapter Supabase desta rodada e a feature de identidade de time / posições customizadas, que já
  estava na árvore sem commit antes da rodada começar. O recorte separado foi oferecido e recusado
  conscientemente — o adapter não compila sem `PosCode`/`PositionDef`/`teamColors`, que chegaram
  com aquele trabalho.
- Próximo item recomendado: **auth real (Fase 4, item 1)** — sem ela o adapter entregue não carrega
  nada, porque `load()` para em `auth_required` por desenho.
