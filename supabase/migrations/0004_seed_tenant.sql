-- Tenant inicial. O slug "demo" e o que o main.tsx usa como rota padrao
-- (/t/demo/ranking), entao o app abre nele sem mudanca de UI.
--
-- A subscription nasce igual a pendingSubscription() de src/data/tenant.ts:
-- plano free, sem cartao, teste ainda nao iniciado. Enquanto nao houver cartao
-- o grupo fica em somente leitura — e o que a regra de cobranca ja diz hoje.
-- Nao concedemos vitalicio aqui: isso e decisao do dono, nao do seed.
insert into tenants (slug, name, tagline, primary_color, timezone, team_a_name, team_b_name, team_colors)
values (
  'demo',
  'Futebol da Galera',
  'Confusão, Cultura e Ladaia',
  '#22c55e',
  'America/Sao_Paulo',
  'Branco',
  'Preto',
  '{"branco":"#f1f6f2","preto":"#14181a"}'::jsonb
)
on conflict (slug) do nothing;

insert into subscriptions (tenant_id, plan_code, status, billing_mode, payment_method_on_file)
select id, 'free', 'trialing', 'trial', false from tenants where slug = 'demo'
on conflict (tenant_id) do nothing;
