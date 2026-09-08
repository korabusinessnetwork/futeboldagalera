# 09 · Testes

```bash
npm test          # vitest, 98 casos
npm run build     # tsc -b && vite build
```

## O que é coberto

| Arquivo | Foco |
|---|---|
| `ranking.test.ts` | pontuação, aproveitamento, empate compartilhado, pendente ignorado |
| `rating.test.ts` | fórmula da nota, teto de gols por jogo, média do grupo |
| `draw.test.ts` | ordem de confirmação, formação, goleiros, determinismo, `oop`, passe final |
| `roster.test.ts` | `normName`, numeração, sinônimos de posição, fuzzy match, nomes de exibição |
| `craque.test.ts` | abertura 21:30 + 30 min, timer da abertura manual, encerramento antecipado, elegíveis, apuração |
| `plan.test.ts` | teste de 3 meses, recorrência, blocos de 30 dias, graça, 402, vitalício |
| `seed.test.ts` | importador do dump real, e os números do grupo travados |

## A trava do `seed.test.ts`

Os números do dump real entram como asserção: Felipe B lidera com 17 pontos em 5
jogos, quatro jogadores dividem a 2ª posição com 14, o campeonato tem 64 gols,
90 participações e 4 gols contra. Se alguém mexer num algoritmo sem querer, o
ranking do grupo real acusa na hora.

## Smoke de navegador

O fluxo completo foi exercitado em Chromium: cada aba renderiza, o modo admin
abre as três abas fechadas, e o caminho colar lista → sortear → salvar escalação
termina com a escalação nova nascendo oculta, sem erro de console.
