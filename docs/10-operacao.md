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

**Faça o backup antes do plano do Azure expirar.** `GET /api/data` está aberto,
e é o único insumo que não dá para recriar depois:

```bash
curl -s https://<app-antigo>/api/data > dump.json
```

Duas rotas a partir daí:

1. **Direto no app**: aba Histórico → Importar JSON. Serve para conferir o
   conteúdo antes de subir pro banco.
2. **Para o Postgres**:

```bash
node scripts/import-legacy.mjs dump.json   --slug pmnh --name "PMNH & Amigos" --tagline "Confusão, Cultura e Ladaia" > carga.sql
psql "$DATABASE_URL" -f carga.sql
```

O que o script garante:

- **UUID determinístico** a partir do slug (`sha1(slug:kind:id)`), não do id do
  tenant. Reimportar não duplica, mesmo que o grupo já exista no banco com outro
  id — todo insert é `on conflict do nothing`.
- **`tenant_id` resolvido por subselect** do slug. Se o grupo já existir, a carga
  soma ao que está lá em vez de apontar para um tenant que não foi criado.
- **A escalação inteira** vai para `matches.lineup`, com os ids de jogador já
  reescritos para os UUIDs novos, mais `draw_seed` e `formation_a`/`formation_b`.
  Sem isso o histórico chega ao banco sem escalação nenhuma.
- `slot`, `is_starter`, `out_of_position` e `rating_at_draw` reconstruídos a
  partir da escalação de cada partida.
- Votos agregados viram linhas `legacy-N`, preservando a apuração histórica sem
  inventar votante.
- `is_monthly`, `deleted_at` e a posição criada pelo grupo (`ALA`, `LIB`)
  carregados como estão. Quem saiu do grupo não ressuscita como ativo.

Se algum jogador aparecer numa partida sem estar no elenco do dump, o script
**para antes de gerar qualquer SQL** e lista os ids — a FK estouraria no meio da
carga. Para seguir mesmo assim, deixando essas participações de fora:
`--ignorar-orfaos`.

### Conferir depois da carga

Troque o slug e compare com o que o dump tinha:

```sql
with t as (select id from tenants where slug = 'pmnh')
select (select count(*) from players p, t where p.tenant_id = t.id)          as jogadores,
       (select count(*) from matches m, t where m.tenant_id = t.id)          as partidas,
       (select count(*) from matches m, t
         where m.tenant_id = t.id and m.lineup is not null)                  as com_escalacao,
       (select count(*) from match_entries e join matches m on m.id = e.match_id, t
         where m.tenant_id = t.id)                                           as participacoes,
       (select count(*) from craque_votes v join matches m on m.id = v.match_id, t
         where m.tenant_id = t.id)                                           as votos;
```

Rodando sobre `seed/demo.json`: 36 jogadores, 5 partidas, 5 com escalação,
90 participações, 68 votos. Esses números foram conferidos contra o banco de
verdade num tenant descartável, incluindo uma segunda carga para provar que
reimportar não duplica.

Depois da carga, ligue a `membership` do dono no grupo novo — mesmo SQL da seção
anterior, trocando o slug.

## Deploy

Vercel ou Cloudflare Pages. Build `npm run build`, saída `dist/`. Custo próximo
de zero no início. O roteamento é por hash (`/#/t/:slug/...`), então não exige
rewrite no host.
