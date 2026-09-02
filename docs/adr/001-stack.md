# ADR-001 · Stack

**Status**: aceito · **Data**: 2026-09-02

## Contexto

O app de referência é um `index.html` de 129 KB, vanilla, sem build, hospedado em
Azure Static Web Apps com plano vencendo. Precisa virar um SaaS multi-tenant com
assinatura, sem perder a leveza que faz ele funcionar no campo com sinal ruim.

## Decisão

- **Front**: React 18 + Vite + TypeScript + Tailwind. React Router para as rotas
  por slug, Zustand para o estado do sorteio.
- **Back**: Supabase (Postgres + Auth + RLS + Storage + Edge Functions).
- **PWA**: manifest, instalável, mobile-first, tema escuro.
- **Deploy**: Vercel ou Cloudflare Pages.

## Consequências

- TypeScript strict permite transcrever os algoritmos da spec como funções puras
  e cobrir com teste. Era o maior risco do original: a lógica estava amarrada ao
  DOM e não dava para verificar nada.
- Supabase entrega Postgres com RLS, auth e storage sem servidor próprio. RLS é
  o que torna o multi-tenant defensável.
- Bundle atual: 267 KB, 83 KB gzip. Cabe no 3G de campo de várzea.
- Custo do não-decidido: enquanto o Supabase não entra, o app roda num adapter
  local. Isso é intencional — ver ADR-004.
