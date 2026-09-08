# 01 · Produto

## Personas

- **Organizador (owner/admin)**: monta o time, cobra a mensalidade, apanha do
  grupo quando o sorteio sai torto. É quem paga.
- **Atleta (player)**: confirma presença, olha o ranking, vota no craque.
- **Curioso (viewer)**: recebe o link do ranking no grupo e abre.

## Abas

| Aba | Quem vê | O que faz |
|---|---|---|
| 🏆 Ranking | público | classificação da temporada, com medalhas e empate compartilhado |
| ⚽ Artilharia | público | gols, média por jogo, total do campeonato |
| 🟢 Escalação do dia | público **com gate** | só aparece depois que o admin libera |
| ⭐ Craque do jogo | público | abre 21:30 e dura 30 min (fecha sozinha), admin encerra antes se quiser, modo suspense, card compartilhável |
| 📅 Histórico | público | partidas em ordem reversa; manutenção só para admin |
| 👤 Jogadores | admin | CRUD do elenco, foto comprimida no cliente |
| ➕ Partida | admin | placar, V/E/D auto-derivado, gols e gols contra |
| ⚖️ Sorteio | admin | formações, lista do WhatsApp, avulsos, sorteio equilibrado |
| 📜 Regras | público | pontuação, desempate, premiação |

## Regras de negócio que não se negociam

1. **Quem confirma primeiro é titular.** Regra social, não técnica. É o que
   segura a paz do grupo.
2. **Partida pendente não conta no ranking.** Só entra quando o admin encerra,
   e o app avisa disso no modal.
3. **Jogador com partida registrada não pode ser excluído.** Furaria o
   histórico. Só soft delete.
4. **A escalação nasce oculta.** O admin libera quando quiser.
5. **Nenhum dado é apagado por causa de cobrança.** Plano estourado ou tempo
   vencido derrubam a escrita, nunca o dado.
