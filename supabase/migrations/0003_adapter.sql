-- O que o adapter Supabase precisa alem do 0001.

-- ---------------------------------------------------------------- branding
-- teamColors e positions existem em TenantBranding desde o branding
-- white-label e nao tinham coluna.
alter table tenants add column if not exists team_colors jsonb;
alter table tenants add column if not exists positions   jsonb;

-- ---------------------------------------------------------------- escalacao
-- O Lineup do dominio carrega avulsos (id "av-*") que nao tem row em players:
-- gravar normalizado violaria a FK match_entries.player_id. O blob fica aqui e
-- draw_seed segue preenchido a partir de lineup.seed, para auditoria e consulta.
alter table matches add column if not exists lineup jsonb;

-- ---------------------------------------------------------------- apuracao
-- A policy own_vote_read so expoe o proprio voto, entao a contagem nao pode
-- sair de um select do cliente. Sai daqui, e so para quem e do tenant.
create or replace function craque_tally(p_match uuid)
returns table (player_id uuid, votes int)
language sql stable security definer set search_path = public as $$
  select v.player_id, count(*)::int
  from craque_votes v
  join matches m on m.id = v.match_id
  where v.match_id = p_match and is_member(m.tenant_id)
  group by v.player_id;
$$;

revoke all on function craque_tally(uuid) from public;
grant execute on function craque_tally(uuid) to authenticated;

-- ---------------------------------------------------------------- posicoes
-- players.pos nasceu preso aos cinco codigos base, mas o branding deixa o grupo
-- criar posicao propria (PositionDef: rotulo do grupo -> papel base). O check
-- rejeitaria "ALA". match_entries.slot continua preso aos cinco, e correto:
-- formacao e sorteio so sabem trabalhar com os papeis base.
alter table players drop constraint if exists players_pos_check;

-- Mesma apuracao, o grupo inteiro de uma vez: o load() precisa da contagem de
-- todas as partidas e uma chamada por partida seria N+1.
create or replace function craque_tally_tenant(p_tenant uuid)
returns table (match_id uuid, player_id uuid, votes int)
language sql stable security definer set search_path = public as $$
  select v.match_id, v.player_id, count(*)::int
  from craque_votes v
  join matches m on m.id = v.match_id
  where m.tenant_id = p_tenant and is_member(p_tenant)
  group by v.match_id, v.player_id;
$$;

revoke all on function craque_tally_tenant(uuid) from public;
grant execute on function craque_tally_tenant(uuid) to authenticated;
