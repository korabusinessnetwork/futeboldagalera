# 05 · API

A porta `Repository` (`src/data/repo.ts`) é o contrato. O adapter Supabase
mapeia cada método para a rota abaixo; o adapter local resolve em memória.

```
GET    /t/:slug/ranking                  público (RPC public_ranking)
GET    /t/:slug/scorers                  público
GET    /t/:slug/lineup/latest            público se lineup_published
POST   /t/:slug/vote                     { matchId, playerId }, rate-limited
GET    /t/:slug/players                  membro
POST   /t/:slug/players                  admin, valida limite do plano
PATCH  /t/:slug/players/:id              admin
DELETE /t/:slug/players/:id              admin, soft delete, bloqueia se tem entries
POST   /t/:slug/draw                     admin, devolve lineup, NÃO grava
POST   /t/:slug/matches                  admin, cria a partida a partir do lineup
PATCH  /t/:slug/matches/:id              admin, placar, resultados, gols
POST   /t/:slug/matches/:id/publish      admin, libera escalação
POST   /t/:slug/matches/:id/craque       admin, define craque manualmente
POST   /t/:slug/photos                   admin, upload para Storage
POST   /billing/payment-method           vincula cartão (SetupIntent) e inicia o teste
POST   /billing/activate                 liga a cobrança recorrente
POST   /billing/period                   compra um bloco de 30 dias
POST   /billing/portal                   Customer Portal
POST   /billing/webhook                  provedor → atualiza subscriptions
POST   /admin/grant-lifetime             INTERNO, service role apenas
```

## Regras

- **Nenhuma escrita faz overwrite de documento inteiro.** Tudo é UPDATE
  granular com `updated_at`.
- `POST /players` acima do limite responde **402** com
  `{ error: "plan_limit", limit, current, upgrade_url }`. O front abre o modal
  de upgrade.
- `POST /draw` **não grava**: o admin sorteia quantas vezes quiser antes de
  salvar. Só `POST /matches` persiste.
- O ranking público sai por RPC `security definer`, sem votos e sem dado de
  conta, para o link ser compartilhável fora do grupo.
