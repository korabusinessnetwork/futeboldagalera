# Migração do portal antigo para o Supabase

Rodada 3 do loop · 2026-09-08

## 1. Escopo

Deixar o caminho de migração correto e **provado contra o banco de verdade**, para que trazer o dump
do PMNH seja um comando só quando o arquivo existir. Inclui corrigir o
`scripts/import-legacy.mjs` contra o schema atual (que mudou nas rodadas 1 e 2), extrair as funções
puras dele para teste, e rodar a carga inteira num tenant descartável no projeto
`xqqxfmcwamcpyrheofcb`, conferindo os números e apagando depois.

## 2. Fora de escopo

- **A carga de produção em si.** Ela depende de dois insumos que só o dono tem: o `dump.json` do
  portal antigo, ou a URL do app no Azure para baixá-lo. `seed/demo.json` **não serve**:
  `memory/contexto.md` diz que ele entra "só como exemplo/seed, nunca como dado de produção", e são
  5 partidas — o histórico real do grupo é maior.
- Escolher o slug e o nome definitivos do tenant de produção (hoje o app abre em `/t/demo`).
- Desligar ou mexer no app antigo no Azure.
- Migrar fotos para o Storage (seguem como dataURL; está registrado em `docs/06-seguranca.md`).
- Gateway, onboarding, magic link.

## 3. Origem e decisões que este item honra

- `docs/10-operacao.md` e `README.md`: "Faça o backup ANTES do plano do Azure expirar."
- `memory/contexto.md`: o portal antigo "roda em Azure Static Web Apps com plano vencendo".
- `specs/_loop.md`, rodada 2: era o próximo item recomendado, por ser o único com prazo fora do
  nosso controle.
- ADR-002: o dado importado nasce isolado por tenant.
- Rodada 1: a escalação passou a morar em `matches.lineup jsonb`, e o importador ainda não sabia
  disso.

## 4. Arquivos afetados

Modificados:
- `scripts/import-legacy.mjs` — grava a escalação, corrige o tenant já existente, exporta as funções
  puras
- `docs/10-operacao.md` — o procedimento real de migração, com a conferência pós-carga

Criados:
- `scripts/import-legacy.d.mts` — tipos das funções exportadas, para o teste
- `src/tests/importLegacy.test.ts` — teste das funções puras

## 5. Critérios de aceite

1. `npm test` verde com os testes novos, e `npm run build` limpo.
2. O SQL gerado grava `matches.lineup` com o blob da escalação e `matches.draw_seed` a partir de
   `lineup.seed`. Nenhuma partida com escalação no dump chega ao banco sem escalação.
3. Quando o slug já existe, a carga usa o `id` do tenant existente em vez de inserir linhas
   apontando para um tenant que não foi criado. Rodar contra um slug existente não gera erro de
   chave estrangeira.
4. Posição criada pelo grupo (`ALA`, `LIB`) é preservada em `players.pos`; `match_entries.slot`
   continua restrito aos cinco papéis base, porque formação e sorteio só sabem trabalhar com eles.
5. `is_monthly` e `deleted_at` do dump são carregados; jogador apagado no portal antigo não
   ressuscita como ativo.
6. A carga é idempotente: rodar duas vezes seguidas não duplica nada e não falha.
7. Dinheiro não aparece nesta rodada; nenhum float onde o schema espera inteiro.
8. As funções puras do script têm teste e não tocam em rede, arquivo ou `process.argv`.
9. **Ensaio contra o banco real**: a carga do `seed/demo.json` roda num tenant descartável do
   projeto, e os números conferem com o dump — 36 jogadores, 5 partidas, 5 escalações, 90
   participações, 68 votos. O tenant é apagado no fim e o banco volta ao estado anterior.
10. Nenhum segredo no código ou no SQL gerado: `grep -r "sb_publishable\|sbp_\|xqqxfmcw" scripts/`
    volta vazio.
11. Nenhum `console.log` esquecido no código de produção (o script é CLI: escrever no stdout é a
    função dele), nenhum `TODO` sem justificativa.
12. `docs/10-operacao.md` traz o procedimento completo, incluindo o que conferir depois da carga
    para saber que deu certo.

## 6. Edge cases conhecidos

- **Slug já existente** com dados dentro: a carga precisa somar, não quebrar.
- **Partida sem escalação, sem placar ou sem entradas** no dump antigo.
- **Voto agregado sem votante**: o portal antigo guardava `{playerId: contagem}`, sem identidade.
  Viram linhas `legacy-N`, que é o que preserva a apuração sem inventar votante.
- **Jogador citado numa partida mas ausente da lista de jogadores** — a FK estouraria; precisa ser
  detectado e relatado, não engolido.
- **Aspas simples em nome de jogador ou tagline** (SQL injection acidental na geração).
- **Reimportar** depois de já ter importado: coberto pelo UUID determinístico.

## 7. Definição de "aprovado sem ressalvas"

Os 12 critérios em sim, `npm test` verde, `npm run build` limpo, o ensaio contra o banco batendo os
números e o tenant descartável removido no fim, sem TODO pendente.

---

## Resultado da review (rodada 3, 2026-09-08)

**Aprovado sem ressalvas.** 12 de 12 criterios em "sim". `npm test` verde (154 testes, 10 arquivos),
`npm run build` limpo.

Dois bugs do importador corrigidos nesta rodada, ambos registrados em `memory/bugs.md`:

- **Escalacao perdida**: o script nao gravava `matches.lineup`, coluna que nasceu na rodada 1. O
  historico chegaria ao banco com placar e sem time.
- **Reimportacao quebrada**: o UUID deterministico derivava de um `tenantId` aleatorio, e as linhas
  filhas cravavam esse id literal enquanto o `on conflict (slug) do nothing` mantinha o tenant
  antigo. Duas execucoes duplicariam tudo, ou estourariam a FK.

Ensaio contra o banco real, num tenant `ensaio-import` criado e apagado dentro da rodada:

| conferencia | dump | banco |
|---|---|---|
| jogadores | 36 | 36 |
| partidas | 5 | 5 |
| partidas com escalacao | 5 | 5 |
| participacoes | 90 | 90 |
| votos | 68 | 68 |

Mais: segunda carga com `--tenant-id` diferente e slug ja existente nao duplicou nada e nao deu erro
de FK; 80 ids de jogador dentro dos blobs de escalacao, **0 quebrados**; tenant removido no fim e o
banco de volta ao estado anterior (so o `demo`, zero em tudo mais).

`draw_seed` ficou null no ensaio porque o `seed/demo.json` e anterior a semente deterministica — o
caso com semente esta coberto pelo teste unitario.

## O que trava a carga de producao

O caminho esta pronto e provado, mas a migracao de verdade **nao pode ser feita por aqui**: falta o
insumo. E preciso um dos dois:

- o arquivo `dump.json` do portal antigo, ou
- a URL do app no Azure, para baixa-lo com o `curl` do `docs/10-operacao.md`.

`seed/demo.json` nao serve: `memory/contexto.md` diz que ele entra "so como exemplo/seed, nunca como
dado de producao", e sao 5 partidas — o historico real do grupo e maior.

Falta tambem decidir o **slug e o nome definitivos** do grupo de producao. Hoje o app abre em
`/t/demo`, e o exemplo dos docs usa `pmnh`.
