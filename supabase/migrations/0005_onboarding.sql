-- Onboarding: o grupo nasce pelo app, nao pelo SQL Editor.
--
-- Por que precisa ser `security definer`: `tenants` nao tem policy de insert, e
-- a de `memberships` exige `is_admin(tenant_id)`, que le `memberships`. Quem
-- ainda nao esta dentro nunca consegue entrar — o circulo so quebra aqui.
--
-- As tres linhas nascem na mesma transacao: grupo sem assinatura ou sem dono
-- seria um tenant que ninguem consegue abrir nem apagar.
create or replace function create_tenant(
  p_name    text,
  p_slug    text,
  p_tagline text default null,
  p_color   text default '#22c55e'
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_slug  text := lower(btrim(coalesce(p_slug, '')));
  v_name  text := btrim(coalesce(p_name, ''));
  v_color text := coalesce(nullif(btrim(coalesce(p_color, '')), ''), '#22c55e');
  v_id    uuid;
  v_donos int;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if v_name = '' then
    raise exception 'nome_vazio' using errcode = '22023';
  end if;

  -- Mesmo formato que o front valida em src/domain/slug.ts. Repetido aqui de
  -- proposito: validacao no cliente e conveniencia, nao garantia.
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,30}$' then
    raise exception 'slug_invalido' using errcode = '22023';
  end if;

  if v_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'cor_invalida' using errcode = '22023';
  end if;

  -- Teto por dono. Hoje so quem tem conta criada no painel chega aqui, entao o
  -- risco e baixo; quando o autocadastro existir, esta e a linha que segura
  -- criacao em massa. Numero conservador de proposito, facil de mudar.
  select count(*) into v_donos from memberships where user_id = v_uid and role = 'owner';
  if v_donos >= 5 then
    raise exception 'limite_de_grupos' using errcode = '54000';
  end if;

  insert into tenants (slug, name, tagline, primary_color)
  values (v_slug, left(v_name, 60), nullif(btrim(coalesce(p_tagline, '')), ''), v_color)
  returning id into v_id;

  -- Assinatura igual a pendingSubscription() do front: plano free, sem cartao,
  -- teste ainda nao iniciado. Conceder plano aqui seria auto-concessao.
  insert into subscriptions (tenant_id) values (v_id);

  insert into memberships (tenant_id, user_id, role) values (v_id, v_uid, 'owner');

  return v_slug;
exception
  when unique_violation then
    raise exception 'slug_em_uso' using errcode = '23505';
end $$;

revoke all on function create_tenant(text, text, text, text) from public;
grant execute on function create_tenant(text, text, text, text) to authenticated;
