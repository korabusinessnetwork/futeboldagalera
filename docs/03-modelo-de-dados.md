# 03 · Modelo de dados

O schema canônico está em `supabase/migrations/0001_init.sql`. Os tipos do
front espelham ele em `src/domain/types.ts`.

## Tabelas

| Tabela | Papel |
|---|---|
| `tenants` | o grupo, com branding white-label |
| `memberships` | usuário × tenant × papel, opcionalmente ligado a um `player` |
| `plans` | catálogo; `is_public = false` esconde o vitalício do checkout |
| `subscriptions` | 1 por tenant: plano, modo de cobrança, cartão, datas |
| `billing_periods` | extrato de cada bloco de 30 dias comprado |
| `players` | elenco; soft delete via `deleted_at` |
| `matches` | partida; `season` é coluna gerada a partir do ano |
| `match_entries` | participação: time, slot, titular, `rating_at_draw`, resultado, gols |
| `craque_votes` | PK `(match_id, voter_key)` — 1 voto por votante, garantido pelo banco |
| `audit_log` | quem mexeu no quê |

## Detalhes que importam

**`rating_at_draw`** congela a nota usada naquele sorteio (melhoria 8.4). Sem
isso, seis meses depois ninguém consegue explicar por que fulano foi pro time
mais fraco.

**`draw_seed`** guarda a semente. Mesma lista + mesma semente = mesmo sorteio.

**`season`** é `to_char(date, 'YYYY')` gerado. O grupo joga o ano inteiro e
reseta em janeiro; o ranking filtra por temporada (melhoria 8.6).

**`legacy_id`** guarda o id do dump antigo, então reimportar não duplica.

**Posições**: `GOL, ZAG, VOL, MC, ATA`. `is_app` marca o pseudo-jogador
"Goleiro App", que fica fora de ranking e artilharia.
