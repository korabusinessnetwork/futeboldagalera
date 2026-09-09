# 11 · Roadmap

| Fase | Escopo | Estado |
|---|---|---|
| 0 | Fundação: `memory/`, `docs/00→11`, ADRs, plano de segurança | ✅ |
| 1 | Paridade single-tenant: CRUD, ranking, artilharia, histórico | ✅ |
| 2 | Motor de sorteio puro + testes, formações, import de lista, escalação com gate, imagem | ✅ |
| 3 | Craque com janela, votação, cards de compartilhamento | ✅ |
| 4 | SaaS: onboarding, white-label, planos, gateway, painel do dono | 🟡 domínio pronto e testado, falta o gateway e a auth |
| 5 | Migração do JSON antigo | ✅ importador pronto |

## O que falta para a Fase 4 fechar

1. ✅ **Auth real**: login por e-mail/senha, sessão persistida e `memberships`
   no lugar do toggle local (`specs/auth-real.md`). Magic link e autocadastro
   ficaram de fora: dependem de SMTP contratado, custo levantado na seção 8
   daquele spec. Contas nascem no painel — ver `docs/10-operacao.md`.
2. ✅ **Adapter Supabase**: a porta `Repository` contra o Postgres
   (`specs/adapter-supabase.md`). O domínio e a UI não mudaram.
3. **Gateway**: SetupIntent no cadastro (cartão sem cobrar), assinatura para a
   recorrência, cobrança avulsa para os blocos de 30 dias, webhook atualizando
   `subscriptions` e gravando `billing_periods`.
4. ✅ **Onboarding em 3 passos** (`specs/onboarding-tenant.md`): nome do grupo →
   colar lista de jogadores → primeiro sorteio, em `/novo`. O grupo e a primeira
   `membership` nascem pela RPC `create_tenant`. O **escudo** ficou de fora:
   depende do Storage por tenant, que ainda não existe.

## Melhorias da seção 8 da spec

| # | Melhoria | Estado |
|---|---|---|
| 1 | Sorteio como função pura e testável | ✅ |
| 2 | Semente determinística | ✅ exposta na UI e salva na escalação |
| 3 | Confirmação de presença pelos atletas | ⬜ import de lista segue como fallback |
| 4 | Histórico de nota (`rating_at_draw`) | ✅ no schema e no importador |
| 5 | Voto à prova de fraude | ✅ constraint no banco; rate limit por IP com a Edge Function |
| 6 | Multi-temporada | ✅ coluna gerada + filtro no ranking |
| 7 | Mensalidade do grupo | ⬜ upsell natural do plano Liga |
| 8 | Web Push na liberação da escalação e na abertura da votação | ⬜ |
| 9 | Card de imagem no servidor | ⬜ canvas client-side por enquanto |
| 10 | Onboarding em 3 passos | ✅ sem o escudo, que espera o Storage |
