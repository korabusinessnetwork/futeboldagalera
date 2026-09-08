# 10 · Operação

## Rodar

```bash
npm install
npm run dev       # http://localhost:5173 → /#/t/demo/ranking
```

Sem variável de ambiente nenhuma, o app sobe no adapter local e é seedado com
`seed/demo.json` (dump real do grupo de referência, usado **só como exemplo**).
O estado fica em `localStorage`, chave `fdg_v1_<slug>`.

O botão 🔒/🔓 no cabeçalho alterna atleta ↔ admin. É um toggle de demonstração,
não autenticação — e ele **só existe no modo local**.

## Rodar contra o Supabase

Preencha `.env` a partir do `.env.example`:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave publishable>
```

Com as duas preenchidas o app troca o adapter local pelo Supabase e passa a
exigir login. O toggle de admin some: o papel vem de `memberships`, checado no
banco.

### Criar a conta dona e ligar a primeira membership

Ainda não existe cadastro pelo app: magic link, autocadastro e "esqueci a senha"
dependem de SMTP contratado (ver `specs/auth-real.md`, seção 8). Enquanto isso a
conta nasce no painel, e a primeira `membership` é ligada na mão. É passo de
operação, não de produto — por isso não tem e-mail de ninguém cravado em código
nem em migration.

1. Painel do Supabase → **Authentication → Users → Add user**. Informe e-mail e
   senha e marque **Auto Confirm User** (sem isso a conta fica pendente de um
   e-mail que o projeto ainda não consegue enviar).
2. Painel → **SQL Editor**, trocando os dois valores:

```sql
insert into memberships (tenant_id, user_id, role)
select t.id, u.id, 'owner'
from tenants t, auth.users u
where t.slug = 'demo'            -- o grupo
  and u.email = 'voce@exemplo.com'  -- a conta criada no passo 1
on conflict (tenant_id, user_id) do update set role = excluded.role;
```

3. Abra o app e entre com essa conta. Sem a `membership`, a RLS esconde o grupo
   e o app diz "Grupo não encontrado ou você não é membro dele" — que é o
   comportamento correto, não um bug.

Para dar acesso a mais gente, repita o passo 1 e troque `'owner'` por `'admin'`,
`'player'` ou `'viewer'`. Convite pelo app entra junto com o onboarding
(Fase 4, item 4).

## Migração do app antigo (Fase 5)

**Faça o backup antes do plano do Azure expirar.** `GET /api/data` está aberto:

```bash
curl -s https://<app-antigo>/api/data > dump.json
```

Duas rotas a partir daí:

1. **Direto no app**: aba Histórico → Importar JSON. Serve para validar o
   conteúdo antes de subir pro banco.
2. **Para o Postgres**:

```bash
node scripts/import-legacy.mjs dump.json \
  --slug pmnh --name "PMNH & Amigos" --tagline "Confusão, Cultura e Ladaia" > carga.sql
psql "$DATABASE_URL" -f carga.sql
```

O script gera UUID determinístico a partir do id antigo (`sha1(tenant:kind:id)`),
então reimportar não duplica: todo insert é `on conflict do nothing`. Ele também
reconstrói `slot`, `is_starter`, `out_of_position` e `rating_at_draw` a partir da
escalação de cada partida, e converte os votos agregados em linhas
`legacy-N` para não perder a apuração histórica.

Rodando sobre o dump de exemplo: 36 jogadores, 5 partidas, 90 participações,
68 votos.

## Deploy

Vercel ou Cloudflare Pages. Build `npm run build`, saída `dist/`. Custo próximo
de zero no início. O roteamento é por hash (`/#/t/:slug/...`), então não exige
rewrite no host.
