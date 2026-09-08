-- Futebol da Galera, schema inicial.
-- Multi-tenant desde o primeiro commit: toda tabela de dominio tem tenant_id e
-- RLS ativa. Nenhuma escrita substitui documento inteiro: tudo e UPDATE
-- granular com updated_at.

create extension if not exists pgcrypto;

-- ============================== TENANCY ==============================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                      -- futeboldagalera.app/t/pmnh
  name text not null,
  tagline text,
  logo_url text,
  primary_color text not null default '#22c55e',
  instagram_url text,
  timezone text not null default 'America/Sao_Paulo',
  team_a_name text not null default 'Branco',
  team_b_name text not null default 'Preto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table memberships (
  tenant_id uuid references tenants on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('owner','admin','player','viewer')),
  player_id uuid,                                 -- vincula a conta ao atleta
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index on memberships (user_id);

-- ============================== BILLING ==============================

create table plans (
  code text primary key,                          -- free, galera, time, liga, lifetime
  name text not null,
  price_cents int not null,
  max_players int,                                -- null = ilimitado
  is_public boolean not null default true,        -- lifetime = false
  stripe_price_id text
);

insert into plans (code, name, price_cents, max_players, is_public, stripe_price_id) values
  ('free',    'Entrada',   0,    12,   true,  null),
  ('galera',  'Galera',    1990, 12,   true,  null),
  ('time',    'Time',      3990, 24,   true,  null),
  ('liga',    'Liga',      6990, null, true,  null),
  ('lifetime','Vitalício', 0,    null, false, null);

-- Fluxo de cobranca:
--   1. o grupo vincula um cartao no cadastro e ganha 3 MESES gratis
--      (billing_mode = 'trial', payment_method_on_file = true)
--   2. quando o teste acaba, o dono escolhe:
--      a. ativar a cobranca recorrente no mesmo cartao (billing_mode='recurring')
--      b. nao ativar nada e comprar tempo em blocos de 30 dias ('prepaid')
--   Nenhum dado e apagado quando o tempo acaba: o tenant vira somente leitura.
create table subscriptions (
  tenant_id uuid primary key references tenants on delete cascade,
  plan_code text not null references plans default 'free',
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','expired','canceled','over_limit')),
  billing_mode text not null default 'trial'
    check (billing_mode in ('trial','recurring','prepaid','lifetime')),
  payment_method_on_file boolean not null default false,
  trial_ends_at timestamptz,                      -- fim dos 3 meses
  current_period_end timestamptz,                 -- fim do pago; null no lifetime
  stripe_customer_id text,
  stripe_subscription_id text,                    -- so no modo recurring
  updated_at timestamptz not null default now(),
  -- o teste so vale com cartao vinculado
  constraint trial_requires_card
    check (billing_mode <> 'trial' or trial_ends_at is null or payment_method_on_file)
);

-- Cada bloco de 30 dias comprado. Serve de extrato e de auditoria de receita.
create table billing_periods (
  id bigserial primary key,
  tenant_id uuid not null references tenants on delete cascade,
  plan_code text not null references plans,
  kind text not null check (kind in ('prepaid','recurring')),
  amount_cents int not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  provider text,                                  -- stripe, pix, manual
  provider_ref text,
  created_at timestamptz not null default now()
);
create index on billing_periods (tenant_id, ends_at desc);

-- ============================== DOMINIO ==============================

create table players (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants on delete cascade,
  name text not null,
  pos text check (pos in ('GOL','ZAG','VOL','MC','ATA')),
  photo_url text,
  is_monthly boolean not null default true,       -- mensalista x avulso recorrente
  is_app boolean not null default false,          -- "Goleiro App": fora do ranking
  legacy_id text,                                 -- id do dump antigo, para a migracao
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index players_tenant_name_uniq
  on players (tenant_id, lower(name)) where deleted_at is null;
create index on players (tenant_id) where deleted_at is null;

create table matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants on delete cascade,
  date date not null,
  season text generated always as (extract(year from date)::text) stored,
  status text not null default 'draft'            -- draft, pending, finished
    check (status in ('draft','pending','finished')),
  score_a int, score_b int,                       -- a = branco, b = preto
  lineup_published boolean not null default false,
  vote_state text not null default 'auto' check (vote_state in ('auto','open','closed')),
  vote_opened_at timestamptz,                     -- abertura manual: fecha sozinha 30 min depois
  craque_player_id uuid references players,
  formation_a text, formation_b text,             -- "2-1-2-1"
  draw_seed bigint,                               -- reproduz o sorteio
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on matches (tenant_id, date desc) where deleted_at is null;
create index on matches (tenant_id, season) where deleted_at is null;

create table match_entries (
  match_id uuid references matches on delete cascade,
  player_id uuid references players,
  team text not null check (team in ('a','b')),
  slot text check (slot in ('GOL','ZAG','VOL','MC','ATA')),
  is_starter boolean not null default true,
  out_of_position boolean not null default false,
  rating_at_draw numeric(5,2),                    -- nota congelada no sorteio
  result text check (result in ('v','e','d')),
  goals int not null default 0,
  own_goals int not null default 0,
  primary key (match_id, player_id)
);
create index on match_entries (player_id);

create table craque_votes (
  match_id uuid references matches on delete cascade,
  voter_key text not null,                        -- user_id, ou hash(device+ip)
  player_id uuid not null references players,
  ip_hash text,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_key)               -- 1 voto por votante, no banco
);
create index on craque_votes (match_id, player_id);

create table audit_log (
  id bigserial primary key,
  tenant_id uuid, user_id uuid, action text, entity text, entity_id uuid,
  payload jsonb, created_at timestamptz not null default now()
);
create index on audit_log (tenant_id, created_at desc);

-- ============================== updated_at ==============================

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger t_tenants_touch before update on tenants
  for each row execute function touch_updated_at();
create trigger t_players_touch before update on players
  for each row execute function touch_updated_at();
create trigger t_matches_touch before update on matches
  for each row execute function touch_updated_at();
create trigger t_subs_touch before update on subscriptions
  for each row execute function touch_updated_at();

-- ============================== RLS ==============================

alter table tenants         enable row level security;
alter table memberships     enable row level security;
alter table subscriptions   enable row level security;
alter table billing_periods enable row level security;
alter table players         enable row level security;
alter table matches         enable row level security;
alter table match_entries   enable row level security;
alter table craque_votes    enable row level security;
alter table audit_log       enable row level security;

create or replace function is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.tenant_id = t and m.user_id = auth.uid())
$$;

create or replace function is_admin(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.tenant_id = t and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
$$;

-- Leitura: membro do tenant. Escrita: owner/admin.
create policy tenant_read on players for select using (is_member(tenant_id));
create policy tenant_write on players for all
  using (is_admin(tenant_id)) with check (is_admin(tenant_id));

create policy tenant_read on matches for select using (is_member(tenant_id));
create policy tenant_write on matches for all
  using (is_admin(tenant_id)) with check (is_admin(tenant_id));

create policy tenant_read on match_entries for select
  using (exists (select 1 from matches m where m.id = match_id and is_member(m.tenant_id)));
create policy tenant_write on match_entries for all
  using (exists (select 1 from matches m where m.id = match_id and is_admin(m.tenant_id)))
  with check (exists (select 1 from matches m where m.id = match_id and is_admin(m.tenant_id)));

-- Voto: o atleta só enxerga o próprio voto. A apuração sai por RPC.
create policy own_vote_read on craque_votes for select
  using (voter_key = auth.uid()::text);
create policy own_vote_write on craque_votes for insert
  with check (voter_key = auth.uid()::text);

create policy tenant_read on tenants for select using (is_member(id));
create policy tenant_write on tenants for update using (is_admin(id)) with check (is_admin(id));

create policy tenant_read on memberships for select using (is_member(tenant_id));
create policy tenant_write on memberships for all
  using (is_admin(tenant_id)) with check (is_admin(tenant_id));

-- Cobrança: leitura para admin, escrita SÓ pelo service role (webhook/checkout).
create policy billing_read on subscriptions for select using (is_admin(tenant_id));
create policy billing_read on billing_periods for select using (is_admin(tenant_id));
create policy audit_read on audit_log for select using (is_admin(tenant_id));

-- ============================== VIEWS PUBLICAS ==============================
-- Ranking compartilhavel por link, sem voto e sem dado de conta.

create or replace function public_ranking(p_slug text, p_season text default null)
returns table (
  rank int, player_id uuid, name text, pos text,
  games int, v int, e int, d int, pts int, pct numeric, goals int
)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, p.name, p.pos,
           count(*)::int as games,
           count(*) filter (where me.result = 'v')::int as v,
           count(*) filter (where me.result = 'e')::int as e,
           count(*) filter (where me.result = 'd')::int as d,
           sum(case me.result when 'v' then 4 when 'e' then 2 else 1 end)::int as pts,
           sum(me.goals)::int as goals
    from tenants t
    join matches m on m.tenant_id = t.id and m.deleted_at is null and m.status = 'finished'
    join match_entries me on me.match_id = m.id
    join players p on p.id = me.player_id and p.deleted_at is null and not p.is_app
    where t.slug = p_slug and t.deleted_at is null
      and (p_season is null or m.season = p_season)
    group by p.id, p.name, p.pos
  ), scored as (
    select *, round(pts::numeric / (games * 4) * 100, 1) as pct from base
  )
  select rank() over (order by pts desc, v desc, pct desc, games desc)::int,
         id, name, pos, games, v, e, d, pts, pct, goals
  from scored
  order by pts desc, v desc, pct desc, games desc, name asc;
$$;

revoke all on function public_ranking(text, text) from public;
grant execute on function public_ranking(text, text) to anon, authenticated;
