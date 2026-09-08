-- plans e tabela de referencia: fica em public e, sem RLS, o role anon do
-- Supabase herda grant de escrita. Leitura para todos, escrita so service role.
alter table plans enable row level security;
create policy plans_public_read on plans for select using (true);
