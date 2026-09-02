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

1. **Auth real**: e-mail/senha + magic link no Supabase, `memberships` de
   verdade no lugar do toggle local.
2. **Adapter Supabase**: implementar a porta `Repository` contra o Postgres. O
   domínio e a UI não mudam.
3. **Gateway**: SetupIntent no cadastro (cartão sem cobrar), assinatura para a
   recorrência, cobrança avulsa para os blocos de 30 dias, webhook atualizando
   `subscriptions` e gravando `billing_periods`.
4. **Onboarding em 3 passos**: nome do grupo + escudo → colar lista de jogadores
   → primeiro sorteio. Alvo: primeiro valor em menos de 3 minutos.

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
| 10 | Onboarding em 3 passos | ⬜ |
