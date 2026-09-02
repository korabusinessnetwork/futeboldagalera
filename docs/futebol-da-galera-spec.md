# Futebol da Galera, especificação técnica completa

Relatório de engenharia reversa do portal **PMNH & Amigos, FUT7** (Azure Static Web Apps) e plano de construção do substituto **Futebol da Galera**, já nascido multi-tenant e com assinatura.

Data do mapeamento: 02/09/2026
Fonte analisada: `index.html` único de 129 KB (HTML + CSS + JS vanilla, sem framework, sem build) e endpoint público `GET /api/data`.

---

## 1. Como o app original funciona

### 1.1 Arquitetura atual

| Camada | Implementação |
|---|---|
| Front-end | 1 arquivo `index.html`, vanilla JS, sem bundler, sem PWA, sem service worker |
| Hospedagem | Azure Static Web Apps (plano expirando) |
| Auth | Azure SWA Built-in Auth com provider **GitHub** (`/.auth/me`, `/.auth/login/github`, `/.auth/logout`) |
| Autorização | Array `ADMINS` **hardcoded no front-end** com usernames do GitHub, duplicado em `api/data/index.js`. Também aceita role `admin` do SWA |
| Backend | Azure Functions, 3 endpoints |
| Persistência | Um único documento JSON global (`{players, matches}`), sem banco relacional |
| Cache | `localStorage` chave `fcCache_v1` para pintura instantânea antes da API responder |

### 1.2 Endpoints existentes

| Método | Rota | Função | Auth |
|---|---|---|---|
| GET | `/api/data` | Retorna `{players, matches}` inteiro | Público, sem auth |
| POST | `/api/data` | Substitui o documento inteiro | Admin (401/403 se não) |
| POST | `/api/vote` | `{matchId, playerId}`, incrementa voto do craque, devolve `{votes}` | Público |
| POST | `/api/photo` | `{playerId, dataUrl}`, salva foto do jogador | Admin |
| GET | `/.auth/me` | Identidade do usuário | Azure SWA |

### 1.3 Falhas graves do original, que NÃO devem ser replicadas

1. **`GET /api/data` é público e devolve o banco inteiro**, incluindo votos e fotos.
2. **`POST /api/data` faz overwrite do documento inteiro**, qualquer race condition entre dois admins perde dados. O código contorna isso com `await loadData()` antes de salvar, o que é um remendo, não uma solução.
3. **Lista de admins no front-end**, dá para ler no view-source quem são os admins.
4. **Voto do craque controlado por `localStorage`**, ou seja, aba anônima vota de novo, sem limite.
5. Zero multi-tenancy, zero cobrança, zero auditoria, sem soft delete, sem histórico de alterações.
6. Sem índices, sem paginação, tudo carregado de uma vez.

---

## 2. Modelo de dados atual (fonte da verdade para migração)

```jsonc
{
  "players": [
    { "id": "ms68vpzrkyl5x", "name": "Anderson Schenkel", "pos": "MC",
      "photo": "opcional", "app": false }   // app:true = "Goleiro App", pseudo-jogador ignorado no ranking
  ],
  "matches": [
    {
      "id": "mtahulhw8od6m",
      "date": "2026-08-26",                 // ISO, sem hora
      "pending": true,                      // partida criada pela escalação, ainda sem placar, NÃO conta no ranking
      "scoreBranco": 3, "scorePreto": 5,    // null enquanto pendente
      "escalaPub": false,                   // false = escalação oculta dos atletas
      "entries": [
        { "playerId": "...", "team": "branco|preto", "result": "v|e|d", "goals": 2, "og": 1 }
      ],
      "lineup": {
        "teams": {
          "branco": { "gk": {...}, "line": [ { "id","name","pos","rating","avulso","slot","oop","j" } ], "res": [...], "total": 402.5 },
          "preto":  { ... }
        },
        "formB": { "ZAG":2, "VOL":1, "MC":2, "ATA":1 },
        "formP": { ... }
      },
      "votes": { "<playerId>": 4, "...": 2 },
      "voteOpen": true,                     // override manual do admin
      "voteClosed": true,                   // override manual do admin
      "craque": "<playerId>"                // definido = votação finalizada
    }
  ]
}
```

Volume real hoje: 36 jogadores, 5 partidas, 44 KB de JSON. Posições usadas: `GOL, ZAG, VOL, MC, ATA`.

---

## 3. Funcionalidades, aba por aba

O app tem 8 abas numa bottom nav fixa. As marcadas com 🔒 só aparecem para admin (`body.is-admin`).

### 3.1 🏆 Ranking (público)
- Tabela: posição, jogador, PTS, J, V, E, D, Aprov.
- Pontuação: **Vitória 4, Empate 2, Derrota 1**. Gol não pontua.
- Aproveitamento = `pontos / (jogos × 4) × 100`.
- Ordenação: `pts desc → v desc → pct desc → jogos desc → nome asc`.
- **Empate real compartilha a mesma posição** (função `assignRanks`, compara `['pts','v','pct','games']`).
- Top 3 recebem 🥇🥈🥉 e destaque visual (linhas com gradiente ouro/prata/bronze).
- Partidas com `pending: true` são ignoradas no cálculo.
- Jogadores com `games === 0` não aparecem.

### 3.2 ⚽ Artilharia (público)
- Ordenação `gols desc → jogos desc → nome`. Mesma lógica de posições compartilhadas, chaves `['goals','games']`.
- Mostra média de gols por jogo e total geral de gols do campeonato.
- Só aparece quem tem `goals > 0`.

### 3.3 👤 Jogadores 🔒
- Cadastrar jogador (nome até 30 chars + posição opcional).
- Alterar posição via select inline, renomear via `prompt()`, excluir.
- **Trava**: não deixa excluir jogador que já aparece em alguma partida.
- Upload de foto: comprime client-side para **320×320 JPEG q=0.72**, crop central quadrado, envia dataURL para `/api/photo`.

### 3.4 ➕ Nova Partida 🔒
- Data + placar Branco × Preto.
- Lista de jogadores com toggle de participação, segmented control V/E/D, input de gols e input de gols contra (`og`).
- **Auto-derivação**: ao digitar o placar, o V/E/D de cada jogador é preenchido automaticamente a partir do `team` dele (`deriveResult`).
- Editar partida existente, e "encerrar" partida pendente (modal de confirmação avisando que os resultados vão entrar no ranking).

### 3.5 ⚖️ Escalação / Sorteio 🔒
É o coração do app. Fluxo:

1. **Escolher formação de cada time**, 6 na linha + goleiro. 7 opções: `2-1-2-1`, `2-2-1-1`, `3-1-1-1`, `2-1-1-2`, `2-0-3-1`, `3-0-2-1`, `2-0-2-2` (ZAG-VOL-MC-ATA).
2. **Adicionar avulsos** (não mensalistas), nome + posição, id prefixado `av-`.
3. **Colar lista do WhatsApp**: textarea, um nome por linha. O parser remove numeração (`1 -`, `2.`, `3)`, `•`, `@`) e faz *fuzzy match* com o elenco:
   - `normName`: remove acentos, minúsculas, remove parênteses, remove não alfanuméricos.
   - Match exato do nome completo, senão match por primeiro nome (`startsWith` bidirecional, mínimo 3 chars), desempate por score de tokens seguintes.
   - Sufixo `(ZAG)` na linha sobrescreve a posição **só para aquele sorteio** (`posOverride`), aceita sinônimos: `gol/goleiro/gk`, `zag/zagueiro/def/fixo`, `vol/volante/cabeca/primeiro`, `mc/mei/meio/meia/ala`, `ata/atac/fw/pivo`.
   - Não encontrados aparecem num modal.
   - **A ordem da lista define a ordem de confirmação, e os últimos viram reservas.**
4. **Marcar confirmados e goleiros**. Exige exatamente 2 goleiros titulares, os extras vão pro banco.
5. **Sortear times equilibrados**.

### 3.6 🟢 Escalação do dia (público, com gate)
- Seletor de data das partidas que têm `lineup`.
- Só aparece para os atletas se `escalaPub !== false`. Admin vê sempre, com badge "🔒 Escalação oculta" e botão "📢 Liberar para os atletas".
- Admin pode ajustar a escalação manualmente pós-criação (clicar em 2 jogadores para trocar de posição, inclusive banco↔titular e goleiro).
- Admin pode alterar a data da partida sem afetar o ranking.
- Botões: compartilhar imagem (Web Share API com arquivo), baixar PNG.

### 3.7 ⭐ Craque do Jogo (público)
- Janela de votação **21:30 às 22:30 (America/Sao_Paulo)**, constantes `CRAQUE_OPEN_MIN=1290`, `CRAQUE_CLOSE_MIN=1350`.
- Estados: `before` (contagem regressiva), `open` (votação), `closed` (apuração), `finalized` (craque definido).
- Elegíveis: todos os jogadores da escalação, titulares, goleiros e reservas dos dois times.
- **Modo suspense**: durante a votação a parcial fica escondida, o resultado só aparece ao encerrar.
- 1 voto por dispositivo, controlado por `localStorage['craqueVote_' + matchId]`.
- Admin: abrir/encerrar votação manualmente, definir o craque na mão (útil em empate), desfazer.
- Card do vencedor + gráfico de barras da votação, compartilhável no WhatsApp e como PNG.

### 3.8 📅 Histórico (público) + Manutenção 🔒
- Lista reversa cronológica das partidas, com placar, badge de vencedor e tags por jogador (`Nome · V ⚽2 🔴1 contra`).
- Partidas pendentes mostram "⏳ Aguardando resultado" e as duas listas de time.
- Admin: editar, excluir, exportar JSON, importar JSON, apagar tudo.

### 3.9 📜 Regras (público)
- Explicação da pontuação, premiação (troféu para o top 3, campeão isento da janta de fim de ano) e critérios de desempate.
- Link "Siga no Instagram".

---

## 4. Algoritmos, transcritos

### 4.1 Nota do jogador (rating 0 a 100)

```js
function calcRating(s){
  if(!s || !s.games) return null;              // sem jogos = sem nota
  const winRate = s.v / s.games;
  const gpg = Math.min(s.goals / s.games, 1);  // gols por jogo, teto 1
  return 0.6*s.pct + 0.25*(winRate*100) + 0.15*(gpg*100);
}
```
- `s.pct` é o aproveitamento (0 a 100).
- Quem nunca jogou, e todo avulso, recebe a **média do grupo** (`avg`), fallback 50 se ninguém tiver nota.

### 4.2 Seleção de titulares (`pickStarters`)
1. Corta os primeiros `LINE` (soma das necessidades das duas formações) pela ordem de confirmação, o resto é reserva.
2. Para cada posição, se faltar gente daquela posição entre os titulares, promove o reserva daquela posição mais bem colocado na ordem, e rebaixa o titular mais atrasado na ordem que esteja em posição com excedente.
3. Reservas ficam ordenados pela ordem de confirmação.

**Regra de ouro: quem confirmou primeiro joga, quem confirmou por último senta no banco.** Isso é social, não técnico, e é o que segura a paz do grupo.

### 4.3 Balanceamento dos times (`balanceByFormation`)
1. Agrupa por posição e ordena por rating desc.
2. Preenche as vagas de cada posição; quem sobra vai pro `pool`.
3. Buracos de posição são tapados com gente do pool, marcada com `oop` (out of position).
4. Distribuição inicial em serpentina por posição, com **jitter aleatório de ±2,5 pontos** (`j = rating + (Math.random()-0.5)*5`) para o sorteio não sair idêntico toda semana.
5. **Otimização local**: até 400 iterações trocando pares de jogadores do **mesmo slot** entre os times, sempre escolhendo a troca que mais reduz `|totalBranco - totalPreto|`. Para quando não há melhora.
6. Reservas distribuídos alternadamente, empate desempatado pelo time de menor total.
7. Goleiros: 1º confirmado no Branco, 2º no Preto.

### 4.4 Nome de exibição
- `buildDisp`: usa só o primeiro nome; se dois jogadores tiverem o mesmo primeiro nome, usa "Primeiro Segundo".
- `dispName`: "Primeiro S." (inicial do sobrenome).

### 4.5 Imagem da escalação (canvas 2D puro, sem biblioteca)
- Canvas **900 × ~1900 px**, gradiente de fundo, header "ESCALAÇÕES", campo desenhado, jogadores posicionados por slot com foto circular ou inicial, faixa de reservas embaixo.
- `canvas.toBlob` → `navigator.share({files})` no mobile, download no desktop.
- Também gera imagem do card do Craque.
- Texto para WhatsApp em `lineupText()`, formato:
```
⚽ Futebol da Galera, Escalação 26/08/2026

⚪ BRANCO (2-1-2-1)
🧤 Marcelo
ZAG - Pavoni
...
Reservas: Fulano, Ciclano
```

---

## 5. O que muda no Futebol da Galera

### 5.1 Decisões de produto

| Tema | Original | Futebol da Galera |
|---|---|---|
| Tenancy | 1 grupo | **Multi-tenant**, N grupos isolados |
| Identidade | Login GitHub | E-mail/senha + magic link, Google opcional |
| Papéis | admin ou visitante | `owner`, `admin`, `player`, `viewer` |
| Monetização | Nenhuma | Assinatura por grupo |
| Voto do craque | localStorage | Vínculo a usuário autenticado ou device fingerprint + IP com rate limit |
| Persistência | JSON global | Postgres com RLS |
| Branding | Fixo PMNH | **White-label por grupo**: nome, slogan, escudo, cor primária, link do Instagram |
| Nomes dos times | Branco/Preto fixo | Configurável por grupo (cor + nome), default Branco/Preto |

### 5.2 Planos e cobrança

| Plano | Preço | Limite de jogadores ativos | Visibilidade |
|---|---|---|---|
| **Free / Trial** | R$ 0 | até 12, por 14 dias | público |
| **Galera** | **R$ 19,90/mês** | até **12** | público |
| **Time** | **R$ 39,90/mês** | até **24** | público |
| **Liga** | **R$ 69,90/mês** | **ilimitado** | público |
| **Vitalício** | definido na venda | ilimitado | **oculto no checkout, só backend** |

Regras de enforcement:
- O limite conta **jogadores ativos** (`deleted_at IS NULL`) do tenant, avulsos de sorteio **não contam** (são efêmeros, não viram cadastro até a partida ser criada).
- Ao estourar o limite: bloqueia `POST /players` com `402 Payment Required` e payload `{ error: "plan_limit", limit, current, upgrade_url }`. Front mostra modal de upgrade.
- **Downgrade**: nunca apaga jogador. Entra em modo `over_limit`, leitura continua liberada, escrita de novos jogadores bloqueada até voltar ao limite ou fazer upgrade.
- **Inadimplência**: 7 dias de graça, depois modo somente leitura. Dados nunca são apagados automaticamente.
- **Vitalício**: `subscriptions.plan = 'lifetime'`, `status = 'active'`, `current_period_end = NULL`, sem `stripe_subscription_id`. Só criável por endpoint admin interno protegido por `SERVICE_ROLE` ou CLI. Nunca listado em `GET /plans`.

### 5.3 Stack proposta

- **Front**: React 18 + Vite + TypeScript, TailwindCSS, React Router, TanStack Query, Zustand para estado do sorteio.
- **Back**: Supabase (Postgres + Auth + RLS + Storage para fotos e escudos + Edge Functions).
- **Billing**: Stripe Checkout + Customer Portal + webhook em Edge Function. (Alternativa BR: Asaas ou Pagar.me com Pix, avaliar, Pix é forte pro público de várzea.)
- **PWA**: manifest + service worker, instalável, offline-first no ranking (o app é usado no campo, com sinal ruim).
- **Deploy**: Vercel ou Cloudflare Pages, custo próximo de zero no início.

---

## 6. Schema Postgres proposto

```sql
-- ============ TENANCY ============
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- futeboldagalera.app/pmnh
  name text not null,                        -- "PMNH & Amigos"
  tagline text,                              -- "Confusão, Cultura e Ladaia"
  logo_url text,
  primary_color text default '#22c55e',
  instagram_url text,
  timezone text default 'America/Sao_Paulo',
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table memberships (
  tenant_id uuid references tenants on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('owner','admin','player','viewer')),
  player_id uuid,                            -- vincula a conta ao atleta
  created_at timestamptz default now(),
  primary key (tenant_id, user_id)
);

-- ============ BILLING ============
create table plans (
  code text primary key,                     -- free, galera, time, liga, lifetime
  name text not null,
  price_cents int not null,
  max_players int,                           -- null = ilimitado
  is_public boolean default true,            -- lifetime = false
  stripe_price_id text
);

insert into plans values
  ('free','Trial',0,12,true,null),
  ('galera','Galera',1990,12,true,'price_xxx'),
  ('time','Time',3990,24,true,'price_yyy'),
  ('liga','Liga',6990,null,true,'price_zzz'),
  ('lifetime','Vitalício',0,null,false,null);

create table subscriptions (
  tenant_id uuid primary key references tenants on delete cascade,
  plan_code text references plans not null default 'free',
  status text not null default 'trialing',   -- trialing, active, past_due, canceled, over_limit
  trial_ends_at timestamptz,
  current_period_end timestamptz,            -- null no lifetime
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz default now()
);

-- ============ DOMÍNIO ============
create table players (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants on delete cascade not null,
  name text not null,
  pos text check (pos in ('GOL','ZAG','VOL','MC','ATA')),
  photo_url text,
  is_monthly boolean default true,           -- mensalista x avulso recorrente
  created_at timestamptz default now(),
  deleted_at timestamptz,
  unique (tenant_id, name) where deleted_at is null
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants on delete cascade not null,
  date date not null,
  status text not null default 'draft',      -- draft, pending, finished
  score_a int, score_b int,                  -- a = branco, b = preto
  lineup_published boolean default false,
  vote_state text default 'auto',            -- auto, open, closed
  craque_player_id uuid references players,
  formation_a text, formation_b text,        -- "2-1-2-1"
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table match_entries (
  match_id uuid references matches on delete cascade,
  player_id uuid references players,
  team text check (team in ('a','b')),
  slot text,                                 -- GOL, ZAG, VOL, MC, ATA
  is_starter boolean default true,
  out_of_position boolean default false,
  rating_at_draw numeric(5,2),               -- nota congelada no momento do sorteio
  result text check (result in ('v','e','d')),
  goals int default 0,
  own_goals int default 0,
  primary key (match_id, player_id)
);

create table craque_votes (
  match_id uuid references matches on delete cascade,
  voter_key text not null,                   -- user_id, ou hash(device+ip) para anônimo
  player_id uuid references players not null,
  created_at timestamptz default now(),
  primary key (match_id, voter_key)          -- 1 voto por votante, garantido pelo banco
);

create table audit_log (
  id bigserial primary key,
  tenant_id uuid, user_id uuid, action text, entity text, entity_id uuid,
  payload jsonb, created_at timestamptz default now()
);
```

**RLS obrigatória em todas as tabelas de domínio.** Padrão:
```sql
alter table players enable row level security;
create policy tenant_read on players for select
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
create policy tenant_write on players for all
  using (exists (select 1 from memberships m
                 where m.tenant_id = players.tenant_id
                   and m.user_id = auth.uid()
                   and m.role in ('owner','admin')));
```
Para o **ranking público** (link compartilhável), criar views `public_ranking(tenant_slug)` expostas via RPC com `security definer`, sem votos e sem dados de conta.

---

## 7. API (Edge Functions / RPC)

```
GET    /t/:slug/ranking                  público (view)
GET    /t/:slug/scorers                  público
GET    /t/:slug/lineup/latest            público se lineup_published
POST   /t/:slug/vote                     { matchId, playerId }, rate-limited
GET    /t/:slug/players                  membro
POST   /t/:slug/players                  admin, valida limite do plano
PATCH  /t/:slug/players/:id              admin
DELETE /t/:slug/players/:id              admin, soft delete, bloqueia se tem entries
POST   /t/:slug/draw                     admin, recebe { formationA, formationB, confirmed[], gks[], avulsos[] }, devolve lineup, NÃO grava
POST   /t/:slug/matches                  admin, cria a partida a partir do lineup
PATCH  /t/:slug/matches/:id              admin, placar, resultados, gols
POST   /t/:slug/matches/:id/publish      admin, libera escalação
POST   /t/:slug/matches/:id/craque       admin, define craque manualmente
POST   /t/:slug/photos                   admin, upload para Storage
POST   /billing/checkout                 cria sessão Stripe
POST   /billing/portal                   Customer Portal
POST   /billing/webhook                  Stripe → atualiza subscriptions
POST   /admin/grant-lifetime             INTERNO, service role apenas
```

Regra: **nenhuma escrita faz overwrite de documento inteiro**. Tudo é UPDATE granular com `updated_at` e checagem de concorrência.

---

## 8. Onde melhorar em relação ao original

1. **Sorteio como função pura e testável**, `draw(players, formationA, formationB, options) => Lineup`, com testes unitários. Hoje está amarrado ao DOM.
2. **Semente determinística no sorteio** (`seed` opcional), para o admin poder reproduzir um sorteio e provar que não teve marmelada.
3. **Confirmação de presença pelos próprios atletas**, lista de presença no app com deadline, elimina o copia-e-cola do WhatsApp. Manter o import de lista como fallback.
4. **Histórico de nota**, guardar `rating_at_draw` para saber a nota usada em cada sorteio.
5. **Votação do craque à prova de fraude**: 1 voto por conta autenticada; para anônimo, chave = hash(deviceId + IP + matchId) com constraint no banco, mais um limite de N votos por IP.
6. **Multi-temporada**: campo `season` em matches, ranking filtrado por temporada. O grupo joga o ano inteiro e reseta em janeiro, o original não tem isso.
7. **Mensalidade do grupo** (opcional, plano Liga): controle de quem pagou o mês do futebol, é a dor número 1 de organizador de várzea, e é um upsell natural.
8. **Notificação**: Web Push quando a escalação é liberada e quando a votação abre.
9. **Card de imagem gerado no servidor** (Satori/Resvg em Edge Function), garante fonte e emoji iguais em todo aparelho. O canvas client-side quebra em Android antigo.
10. **Onboarding do tenant em 3 passos**: nome do grupo + escudo → colar lista de jogadores → primeiro sorteio. Tempo até o primeiro valor abaixo de 3 minutos.

---

## 9. Roadmap sugerido

**Fase 0, fundação** (usar o padrão Kora: `memory/`, `docs/00→11`, ADRs)
- ADR-001 stack, ADR-002 multi-tenancy por `tenant_id` + RLS, ADR-003 gateway de pagamento.

**Fase 1, paridade funcional single-tenant**
- Schema + RLS, auth, CRUD jogadores, CRUD partidas, ranking, artilharia, histórico.

**Fase 2, o diferencial**
- Motor de sorteio (função pura + testes), formações, import de lista, escalação do dia com gate de publicação, imagem compartilhável.

**Fase 3, engajamento**
- Craque do jogo com janela de horário, votação anti-fraude, cards de compartilhamento, Web Push.

**Fase 4, SaaS**
- Onboarding de tenant, white-label, planos, Stripe, enforcement de limite, plano vitalício interno, painel do dono.

**Fase 5, migração**
- Importador que lê o JSON exportado do app antigo (`{players, matches}`) e mapeia para o schema novo. **Fazer o backup antes do plano do Azure expirar**: `GET /api/data` está aberto, basta salvar o JSON.

---

## 10. Prompt pronto para o Claude Code

> Vou construir o **Futebol da Galera**, um SaaS multi-tenant de gestão de peladas e futebol amador.
>
> Antes de escrever código, monte a fundação no padrão Kora, `memory/`, `docs/00→11`, ADRs e plano de segurança, usando a skill `fundacao-de-projeto`. Faça o questionário de intake primeiro.
>
> Stack: React 18 + Vite + TypeScript + Tailwind no front, Supabase (Postgres + Auth + RLS + Storage + Edge Functions) no back, Stripe para assinatura. PWA instalável, mobile-first, tema escuro.
>
> Multi-tenancy desde o primeiro commit: toda tabela de domínio tem `tenant_id`, RLS ativa em todas, rota por slug `/{slug}`, white-label por tenant (nome, slogan, escudo, cor primária).
>
> Planos: Galera R$ 19,90/mês até 12 jogadores, Time R$ 39,90/mês até 24, Liga R$ 69,90/mês ilimitado, mais um plano **vitalício que existe só no backend**, nunca listado no checkout público, criado por endpoint interno protegido por service role.
>
> O anexo `futebol-da-galera-spec.md` traz a especificação completa: modelo de dados, algoritmos de ranking, de nota do jogador e de sorteio balanceado, regras de negócio e roadmap por fase. Siga a seção 4 ao pé da letra para os algoritmos, e a seção 8 para as melhorias em relação ao app de referência.
>
> Comece pela Fase 0 e me mostre os ADRs antes de gerar qualquer código.

---

## 11. Anexo, constantes a preservar

```js
PTS = { v: 4, e: 2, d: 1 }
FORMACOES = ['2-1-2-1','2-2-1-1','3-1-1-1','2-1-1-2','2-0-3-1','3-0-2-1','2-0-2-2']  // ZAG-VOL-MC-ATA
POSICOES = ['GOL','ZAG','VOL','MC','ATA']
RATING = 0.60*aproveitamento + 0.25*(taxaVitoria*100) + 0.15*(min(golsPorJogo,1)*100)
CRAQUE_ABRE  = 21:30 America/Sao_Paulo
CRAQUE_FECHA = 22:30 America/Sao_Paulo
JITTER_SORTEIO = ±2.5 pontos
MAX_ITER_BALANCEAMENTO = 400
FOTO = 320x320 JPEG q=0.72, crop central
CANVAS_ESCALACAO = 900 x ~1900 px
DESEMPATE_RANKING = pts, vitorias, aproveitamento, jogos, nome
DESEMPATE_ARTILHARIA = gols, jogos, nome
```

Paleta original (ponto de partida para o tema default do white-label):
`bg #0a0d0a · card #12180f · card2 #18220f · linha #26331b · texto #e8f3ea · muted #93b29b · accent #22c55e · accent2 #16a34a · ouro #ffd700 · prata #c0c8d0 · bronze #cd7f32 · perigo #ef4444`
