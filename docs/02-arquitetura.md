# 02 · Arquitetura

```
src/
  domain/          núcleo puro: sem React, sem DOM, sem banco. É o que os testes cobrem.
    constants.ts     PTS, formações, janela do craque, jitter, planos
    types.ts         modelo de dados
    stats.ts         agregação por jogador
    ranking.ts       classificação, artilharia, empate compartilhado
    rating.ts        nota 0..100
    match.ts         derivação de V/E/D, entradas a partir da escalação
    draw/            motor de sorteio (rng, starters, balance)
    roster.ts        parser da lista do WhatsApp
    craque.ts        janela de votação e apuração
    plan.ts          cobrança e enforcement
    lineupEdit.ts    ajuste manual pós-sorteio
  data/            porta de persistência e adapters
    repo.ts          interface Repository (escrita SEMPRE granular)
    localRepo.ts     adapter localStorage, roda o app inteiro sem backend
    legacy.ts        importador/exportador do dump do app antigo
    store.ts         zustand + seletores derivados
  ui/              React, Tailwind, canvas de imagem
supabase/migrations/  schema Postgres + RLS + RPC pública
scripts/              importador do dump antigo para SQL
```

## Decisões estruturais

**O domínio não conhece o mundo.** Todo algoritmo da seção 4 da spec é uma
função pura. O sorteio recebe uma lista e devolve uma escalação; não toca no
DOM, não lê `localStorage`, não faz fetch. É por isso que dá para testar 98
casos em um segundo.

**Persistência atrás de uma porta.** `Repository` define operações granulares
(`createPlayer`, `updateMatch`, `vote`, `buyPeriod`). O `LocalRepository` roda o
app inteiro no navegador, seedado com o dump de exemplo. O adapter Supabase
implementa a mesma porta sem tocar em domínio nem em UI.

**Multi-tenancy desde o primeiro commit.** Toda entidade carrega `tenant_id`, a
rota é `/t/:slug/*`, o tema sai do branding do tenant. Não é retrofit.

**Nenhuma escrita substitui documento inteiro.** O bug mais grave do original
era o `POST /api/data` que dava overwrite no banco todo: dois admins salvando ao
mesmo tempo perdiam dados. Aqui cada operação mexe só no que mudou. As duas
exceções (`replaceAll` do import e do apagar tudo) são ações conscientes, atrás
de modal de confirmação.
