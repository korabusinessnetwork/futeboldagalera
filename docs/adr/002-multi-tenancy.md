# ADR-002 · Multi-tenancy por `tenant_id` + RLS

**Status**: aceito · **Data**: 2026-09-02

## Contexto

O original serve um grupo só. O produto precisa servir N grupos isolados. As
opções eram schema por tenant, banco por tenant, ou `tenant_id` com RLS.

## Decisão

`tenant_id` em toda tabela de domínio, com **RLS obrigatória**, desde o primeiro
commit. Rota por slug (`/t/:slug/*`). White-label por tenant: nome, slogan,
escudo, cor primária, link do Instagram, nomes dos times.

O isolamento é do banco, via `is_member(tenant_id)` e `is_admin(tenant_id)`
(`security definer`, `search_path` fixo). A aplicação não é a fronteira de
segurança.

## Alternativas descartadas

- **Schema por tenant**: migração vira N migrações, e o público-alvo é grupo de
  várzea — muitos tenants pequenos. Custo operacional não se paga.
- **Banco por tenant**: mesmo problema, multiplicado.
- **Filtro só na aplicação**: um `where` esquecido vaza o grupo do vizinho. Foi
  exatamente a classe de erro do original (admins hardcoded no front).

## Consequências

- Toda query carrega `tenant_id`; os índices são compostos por ele.
- O ranking público, que precisa ser compartilhável fora do grupo, sai por RPC
  `security definer` sem votos e sem dado de conta.
- Retrofit de multi-tenancy é caro e perigoso; fazer no commit 1 custou pouco.
