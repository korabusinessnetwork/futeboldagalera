# ⚽ Futebol da Galera

SaaS multi-tenant de gestão de peladas e futebol amador. Ranking, artilharia,
sorteio equilibrado, escalação compartilhável e craque do jogo — para N grupos,
cada um com sua marca.

Substitui o portal **PMNH & Amigos (FUT7)**, já nascendo multi-tenant, com RLS,
escrita granular e assinatura.

---

## Rodar

```bash
npm install
npm run dev     # http://localhost:5173  →  /#/t/demo/ranking
```

Sem configurar nada, o app sobe no adapter local e vem seedado com
`seed/demo.json` — o dump real do grupo de referência (36 jogadores, 5 partidas),
usado **apenas como exemplo**. O botão 🔒/🔓 no topo alterna atleta ↔ admin.

```bash
npm test        # 98 testes
npm run build   # tsc -b && vite build
```

## O que já funciona

| | Aba | |
|---|---|---|
| 🏆 | **Ranking** | vitória 4, empate 2, derrota 1; empate real divide a mesma posição; filtro por temporada |
| ⚽ | **Artilharia** | gols, média por jogo, total do campeonato |
| 🟢 | **Escalação do dia** | nasce oculta; admin libera, ajusta arrastando dois jogadores, compartilha PNG ou texto de WhatsApp |
| ⭐ | **Craque do jogo** | janela 21:30–22:30, modo suspense, card compartilhável, override do admin |
| 📅 | **Histórico** | partidas com tags por jogador; export/import JSON |
| 👤 | **Jogadores** | CRUD, foto comprimida no cliente (320×320 q=0.72) |
| ➕ | **Partida** | placar, V/E/D auto-derivado do time, gols e gols contra |
| ⚖️ | **Sorteio** | 7 formações, lista do WhatsApp com fuzzy match, avulsos, semente reproduzível |
| 💳 | **Assinatura** | teste de 3 meses com cartão, depois recorrência ou blocos de 30 dias |

## O sorteio

É o coração do app, e é uma função pura:

```ts
draw(confirmados, formacaoBranco, formacaoPreto, { gkIds, seed }) => Lineup
```

- **Quem confirma primeiro é titular.** Regra social, não técnica — é o que
  segura a paz do grupo.
- Nota = `0.60 × aproveitamento + 0.25 × taxa de vitória + 0.15 × gols por jogo`
  (teto de 1 gol/jogo). Quem nunca jogou herda a média do grupo.
- Balanceamento por serpentina com jitter de ±2,5, depois até 400 trocas locais
  de mesmo slot, mais um passe final que compensa o desequilíbrio do banco.
- **Semente**: mesma lista + mesma semente = mesmo sorteio. Quando alguém
  reclamar do time, dá para repetir e provar que não teve marmelada.

## Cobrança

Cartão vinculado no cadastro → **3 meses grátis** → o dono escolhe:

- **Recorrência** no mesmo cartão, ou
- **Blocos de 30 dias** comprados quando quiser, pelo preço do plano.

| Plano | Preço | Jogadores ativos |
|---|---|---|
| Galera | R$ 19,90 | 12 |
| Time | R$ 39,90 | 24 |
| Liga | R$ 69,90 | ilimitado |

Estourar o limite bloqueia cadastro de jogador com **402**; tempo vencido derruba
a escrita. **Nenhum dado é apagado por causa de cobrança.** O plano vitalício
existe só no backend e nunca aparece no checkout.

## Migrar o app antigo

```bash
curl -s https://<app-antigo>/api/data > dump.json          # faça isso ANTES do Azure expirar
node scripts/import-legacy.mjs dump.json --slug pmnh --name "PMNH & Amigos" > carga.sql
psql "$DATABASE_URL" -f carga.sql
```

UUID determinístico a partir do id antigo: reimportar não duplica. Também dá
para importar direto pela aba Histórico, sem banco.

## Estrutura

```
src/domain/     núcleo puro: ranking, nota, sorteio, craque, cobrança. Sem React, sem DOM.
src/data/       porta Repository + adapter local + importador do dump antigo
src/ui/         React, Tailwind, canvas das imagens
supabase/       schema Postgres, RLS, RPC do ranking público
scripts/        importador do dump antigo para SQL
docs/           00→11 + ADRs
```

Documentação completa em [`docs/`](docs/). Comece por
[`docs/00-visao.md`](docs/00-visao.md) e
[`docs/11-roadmap.md`](docs/11-roadmap.md).

## O que falta

Auth real (e-mail/senha + magic link), adapter Supabase e o gateway de pagamento
— Fase 4. O domínio de cobrança já está pronto e testado; falta plugar.
