# 04 · Algoritmos

Transcritos da seção 4 da spec. Todos vivem em `src/domain/` e são funções
puras. Os números abaixo são travados por teste contra o dump real do grupo.

## Pontuação e ranking

```
PTS = { vitória: 4, empate: 2, derrota: 1 }   // gol não pontua
aproveitamento = pontos / (jogos × 4) × 100
ordem = pts ↓, vitórias ↓, aproveitamento ↓, jogos ↓, nome ↑
```

`assignRanks` compara `['pts','v','pct','games']`: empate real divide a mesma
posição e pula as seguintes. No dump de exemplo, quatro jogadores empatam em 14
pontos e ocupam a 2ª posição — o próximo é o 6º.

Partidas `pending` são ignoradas. Quem tem 0 jogos não aparece.

## Nota do jogador (`calcRating`)

```
0.60 × aproveitamento + 0.25 × (taxaVitória × 100) + 0.15 × (min(golsPorJogo, 1) × 100)
```

Sem jogos, sem nota: quem nunca jogou e todo avulso herdam a média do grupo,
com fallback 50.

## Seleção de titulares (`pickStarters`)

1. Corta os primeiros `LINE` pela **ordem de confirmação**.
2. Se falta gente de uma posição entre os titulares, promove o reserva daquela
   posição melhor colocado na ordem e rebaixa o titular **mais atrasado na
   ordem** que esteja numa posição com excedente. Note: rebaixa o mais atrasado,
   não o pior jogador — a ordem manda.
3. Reservas voltam à ordem de confirmação.

## Balanceamento (`balanceByFormation`)

1. Agrupa por posição, ordena por nota ↓.
2. Preenche as vagas; o excedente vai pro `pool`.
3. Buracos de posição são tapados com o pool, marcados `oop`.
4. Distribuição inicial em serpentina por posição, com jitter de ±2,5 pontos
   (`j = rating + (rand−0.5) × 5`), respeitando a capacidade de cada formação.
5. Otimização local: até 400 iterações trocando pares do **mesmo slot** entre os
   times, sempre a troca que mais reduz `|totalBranco − totalPreto|`.
6. Reservas alternados; empate no número desempata pelo time de menor total.
7. Goleiros: 1º confirmado no Branco, 2º no Preto. Extras vão pro banco.
8. **Passe final (melhoria sobre o original).** O total que o grupo vê inclui o
   banco, mas o passo 5 só equilibra a linha. Quando o banco cai torto — um
   reserva de nota 85 de um lado e um de 32 do outro — o total publicado sai
   desequilibrado mesmo com a linha perfeita. O passe 8 repete as trocas de
   mesmo slot com os reservas entrando como peso fixo, então a linha compensa o
   banco. No caso real do dump isso derrubou a diferença de 45,5 para menos de
   15 pontos, sem quebrar formação nem promover reserva a titular.

O sorteio aceita `seed`. Mesma lista + mesma semente = mesmo resultado.

## Lista do WhatsApp (`roster.ts`)

`normName` remove acento, caixa, parênteses e pontuação. O parser limpa
numeração (`1 -`, `2.`, `3)`, `•`, `@`). Casa nome completo; senão primeiro
nome com `startsWith` bidirecional e mínimo de 3 caracteres, desempatado pelo
score dos tokens seguintes. Sufixo `(ZAG)` sobrescreve a posição **só naquele
sorteio**, aceitando sinônimos (`goleiro/gk`, `fixo/def`, `cabeça/primeiro`,
`mei/ala`, `pivô/fw`). **A ordem da lista é a ordem de confirmação.**

## Nome de exibição

`buildDisp` usa só o primeiro nome; se dois jogadores compartilham o primeiro
nome, os dois viram "Primeiro Segundo". `dispName` gera "Primeiro S.".

## Craque do jogo

Abre 21:30 no fuso do grupo, no dia da partida, e **dura 30 minutos** —
depois fecha sozinha (`CRAQUE_OPEN_MIN = 1290`, `CRAQUE_DURATION_MIN = 30`,
`CRAQUE_CLOSE_MIN = 1320`). Estados: `before`, `open`, `closed`, `finalized`.
A abertura manual do admin carimba `voteOpenedAt` e vale os mesmos 30 minutos;
`voteClosed` encerra antes da hora;
`craque` definido finaliza acima de tudo. Elegíveis: titulares, goleiros e
reservas dos dois times. Durante a votação a parcial fica escondida.
