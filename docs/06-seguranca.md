# 06 · Segurança

## O que estava errado no original, e não se repete aqui

1. `GET /api/data` **público devolvendo o banco inteiro**, incluindo votos e
   fotos. → Aqui a leitura passa por RLS; só o ranking sai por RPC, filtrado.
2. `POST /api/data` **sobrescrevendo o documento inteiro**. Dois admins salvando
   junto perdiam dados. → Escrita granular, sempre.
3. **Lista de admins hardcoded no front**, legível no view-source. → Papéis em
   `memberships`, checados no banco.
4. **Voto do craque no `localStorage`**: aba anônima votava de novo, sem limite.
   → PK `(match_id, voter_key)` no banco. O `localStorage` continua, mas só como
   conveniência de UI; a garantia é a constraint.

## RLS

Ativa em todas as tabelas de domínio. Padrão: leitura para membro do tenant,
escrita para `owner`/`admin`, via as funções `is_member(tenant_id)` e
`is_admin(tenant_id)` (`security definer`, `search_path` fixo).

Cobrança é mais restrita: `subscriptions` e `billing_periods` só são **lidas**
por admin; a escrita é exclusiva do service role (webhook e checkout). Nenhum
caminho autenticado consegue se auto-conceder plano.

`craque_votes` tem policy própria: o atleta só enxerga o **próprio** voto. A
apuração sai agregada, o que preserva o modo suspense.

## Voto anti-fraude

- Conta autenticada: `voter_key = user_id`.
- Anônimo: `voter_key = hash(deviceId + IP + matchId)`, mais limite de N votos
  por IP na Edge Function.
- Em qualquer caso a unicidade é do banco, não da aplicação.

## Plano vitalício

`plans.is_public = false`. Nunca é listado em `GET /plans` nem no checkout. Só
`POST /admin/grant-lifetime`, protegido por service role, cria.

## Pendências conhecidas

- O modo admin do adapter local é um toggle de demonstração, sem auth. Auth real
  (e-mail/senha + magic link) entra com o Supabase, Fase 4. Está escrito na tela.
- Fotos hoje são dataURL no `localStorage`. Vão para o Storage com política por
  tenant.
