# Contexto vivo · Futebol da Galera

Última atualização: 2026-09-02

## O que é

SaaS multi-tenant de gestão de peladas. Substitui o portal PMNH & Amigos (FUT7),
que roda em Azure Static Web Apps com plano vencendo.

## Fonte da verdade

- `docs/futebol-da-galera-spec.md` — a especificação completa que originou o
  projeto. Seção 4 (algoritmos) e seção 11 (constantes) são para seguir ao pé da
  letra; seção 8 lista as melhorias intencionais sobre o original.
- `seed/demo.json` — dump real do grupo de referência: 36 jogadores, 5 partidas.
  Entra **só como exemplo/seed**, nunca como dado de produção.

## Estado

Fases 0–3 e 5 entregues. Fase 4 com o domínio de cobrança pronto e testado,
faltando auth real, adapter Supabase e gateway. Ver `docs/11-roadmap.md`.

98 testes passando. Build limpo. Fluxo verificado ponta a ponta em navegador.

## Decisões que não devem ser revisitadas sem motivo novo

1. **Quem confirma primeiro é titular.** Regra social. Já custou paz de grupo
   antes; não é otimização a fazer.
2. **Escrita sempre granular.** O overwrite de documento inteiro foi o pior bug
   do original.
3. **Multi-tenancy no commit 1.** Retrofit é caro e vaza dado.
4. **Vitalício só existe no backend.** Nunca listado no checkout.
5. **Cobrança nunca apaga dado.** Só derruba escrita.

## Desvio consciente da spec

O passo 8 do balanceamento (passe final considerando os reservas) não está na
seção 4.3. Foi acrescentado porque o total que o grupo vê inclui o banco, e o
original publicava um número que o próprio otimizador ignorava. No dump real
derrubou a diferença entre os times de 45,5 para menos de 15 pontos. Está
documentado em `docs/04-algoritmos.md` e coberto por teste.

## Mudança de escopo registrada

O modelo de cobrança da spec (trial de 14 dias, assinatura mensal) foi
substituído por: teste de 3 meses com cartão vinculado, depois recorrência **ou**
blocos de 30 dias. Ver `docs/adr/005-modelo-de-cobranca.md`.
