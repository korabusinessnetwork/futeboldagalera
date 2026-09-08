# Ledger do loop

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
- Commit: um commit único na branch `claude/adapter-supabase`, por decisão do dono.
- Pendente de decisão: nenhuma. Ficou registrado que este commit **mistura dois trabalhos**: o
  adapter Supabase desta rodada e a feature de identidade de time / posições customizadas, que já
  estava na árvore sem commit antes da rodada começar. O recorte separado foi oferecido e recusado
  conscientemente — o adapter não compila sem `PosCode`/`PositionDef`/`teamColors`, que chegaram
  com aquele trabalho.
- Próximo item recomendado: **auth real (Fase 4, item 1)** — sem ela o adapter entregue não carrega
  nada, porque `load()` para em `auth_required` por desenho.
