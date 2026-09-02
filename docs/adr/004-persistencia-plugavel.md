# ADR-004 · Persistência atrás de uma porta, com adapter local

**Status**: aceito · **Data**: 2026-09-02

## Contexto

O Supabase é a decisão de produção (ADR-001), mas depender dele desde o primeiro
dia trava tudo: sem projeto provisionado não dá para rodar, demonstrar, nem
testar o fluxo de ponta a ponta.

Além disso, o pior bug do original era de persistência: `POST /api/data` fazia
overwrite do documento inteiro, e dois admins salvando ao mesmo tempo perdiam
dados. O código contornava com um `await loadData()` antes de salvar — remendo,
não solução.

## Decisão

Definir uma porta `Repository` com operações **granulares** (`createPlayer`,
`updateMatch`, `vote`, `buyPeriod`, …) e dois adapters:

- `LocalRepository`: `localStorage`, seedado com o dump de exemplo. Roda o app
  inteiro sem backend.
- Adapter Supabase: mesma porta, contra o Postgres. Entra na Fase 4 sem tocar em
  domínio nem em UI.

**Nenhum método da porta aceita o documento inteiro.** As duas exceções
(`replaceAll`, usada no import de JSON e no apagar tudo) são ações conscientes do
admin, atrás de modal de confirmação.

## Consequências

- O app é demonstrável hoje, com dado real, sem credencial nenhuma.
- A forma da API impede por construção o bug de concorrência do original.
- Custo: duas implementações a manter. Aceitável — o adapter local também é o
  modo offline do PWA, que é requisito de campo.
