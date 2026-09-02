# 10 · Operação

## Rodar

```bash
npm install
npm run dev       # http://localhost:5173 → /#/t/demo/ranking
```

Sem variável de ambiente nenhuma, o app sobe no adapter local e é seedado com
`seed/demo.json` (dump real do grupo de referência, usado **só como exemplo**).
O estado fica em `localStorage`, chave `fdg_v1_<slug>`.

O botão 🔒/🔓 no cabeçalho alterna atleta ↔ admin. É um toggle de demonstração,
não autenticação.

## Migração do app antigo (Fase 5)

**Faça o backup antes do plano do Azure expirar.** `GET /api/data` está aberto:

```bash
curl -s https://<app-antigo>/api/data > dump.json
```

Duas rotas a partir daí:

1. **Direto no app**: aba Histórico → Importar JSON. Serve para validar o
   conteúdo antes de subir pro banco.
2. **Para o Postgres**:

```bash
node scripts/import-legacy.mjs dump.json \
  --slug pmnh --name "PMNH & Amigos" --tagline "Confusão, Cultura e Ladaia" > carga.sql
psql "$DATABASE_URL" -f carga.sql
```

O script gera UUID determinístico a partir do id antigo (`sha1(tenant:kind:id)`),
então reimportar não duplica: todo insert é `on conflict do nothing`. Ele também
reconstrói `slot`, `is_starter`, `out_of_position` e `rating_at_draw` a partir da
escalação de cada partida, e converte os votos agregados em linhas
`legacy-N` para não perder a apuração histórica.

Rodando sobre o dump de exemplo: 36 jogadores, 5 partidas, 90 participações,
68 votos.

## Deploy

Vercel ou Cloudflare Pages. Build `npm run build`, saída `dist/`. Custo próximo
de zero no início. O roteamento é por hash (`/#/t/:slug/...`), então não exige
rewrite no host.
