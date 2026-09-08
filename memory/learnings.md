# Aprendizados

## 2026-09-08 · RLS por `auth.uid()` devolve lista vazia, não erro

Toda policy do `0001_init.sql` resolve acesso por `is_member(tenant_id)`, que depende de
`auth.uid()`. Sem sessão, `select` em `tenants`/`players`/`matches` volta `[]` com HTTP 200 —
verificado direto no PostgREST com a chave publishable. Isso é **indistinguível de "grupo sem
dados"**: o app carregaria uma base vazia e diria que deu tudo certo.

Por isso `SupabaseRepository.load()` chama `sessionUserId()` antes de qualquer query e falha com
`RepoError('auth_required')`. Sem essa checagem, o primeiro sintoma do login quebrado seria "sumiu
todo mundo do ranking", que é o pior jeito possível de descobrir.

**Próxima vez**: em adapter que fala com RLS, checar sessão explicitamente antes de ler. Lista vazia
nunca é prova de que a leitura funcionou.

## 2026-09-08 · O schema normalizado não cabia a escalação do domínio

`match_entries.player_id` tem FK para `players`, mas o `Lineup` carrega avulsos com id `av-*` que
nunca viram cadastro. Gravar a escalação normalizada estouraria a FK. A escalação foi para
`matches.lineup jsonb` (migration `0003_adapter.sql`), com `draw_seed` e `formation_a`/`formation_b`
mantidos em sincronia para auditoria.

Isso não fere a regra de escrita granular: `lineup` é **um campo** da partida, não o documento do
tenant. O que a regra proíbe é substituir o estado inteiro por um payload de fora.

**Próxima vez**: antes de mapear domínio para schema, procurar as entidades efêmeras — elas são as
que não têm linha para referenciar.

## 2026-09-08 · `players.pos` estava mais apertado que o próprio produto

O check `pos in ('GOL','ZAG','VOL','MC','ATA')` conflitava com `PositionDef` do branding, que deixa o
grupo criar posição própria (`ALA`, `LIB`) apontando para um papel base. Cadastrar `ALA` daria erro
de check. Removido em `0003_adapter.sql`. `match_entries.slot` continua preso aos cinco, e está
certo: formação e sorteio só sabem trabalhar com os papéis base.

**Próxima vez**: quando o produto ganha customização de vocabulário, varrer os `check` do schema —
eles congelam o vocabulário antigo em silêncio até alguém tentar usar o novo.

## 2026-09-08 · Nome de coluna errado passa no `tsc` e só quebra em produção

O adapter monta os `select` como string (`TENANT_COLS`, `MATCH_COLS`, ...). Typo nenhum aí é pego
por typecheck nem por teste unitário. Foi conferido comparando as 5 listas contra
`information_schema.columns` do banco vivo, mais as 42 colunas usadas em insert/update: 95 no total,
todas existentes.

**Próxima vez**: adapter novo pede uma conferência das listas de coluna contra o schema real. É
barato e pega a classe de erro mais cara.
