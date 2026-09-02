# 00 · Visão

**Futebol da Galera** é um SaaS multi-tenant de gestão de peladas e futebol amador.

## O problema

Todo grupo de várzea resolve as mesmas coisas no grito, no grupo do WhatsApp e na
planilha do organizador: quem confirmou, quem joga com quem, quem foi bem, quem
ganhou o campeonato no fim do ano. Existe um app de referência que resolve isso
para um grupo só (PMNH & Amigos, FUT7), rodando em Azure Static Web Apps com
plano vencendo, um `index.html` de 129 KB e um JSON global sem dono.

## O que estamos construindo

O substituto, já nascido multi-tenant e com assinatura. Mesmo valor para o
organizador, sem os buracos do original:

| Tema | Original | Futebol da Galera |
|---|---|---|
| Tenancy | 1 grupo | N grupos isolados por `tenant_id` + RLS |
| Identidade | Login GitHub | E-mail/senha + magic link |
| Papéis | admin ou visitante | `owner`, `admin`, `player`, `viewer` |
| Monetização | nenhuma | teste de 3 meses, depois recorrência ou blocos de 30 dias |
| Voto do craque | `localStorage` | 1 voto por votante garantido no banco |
| Persistência | JSON global sobrescrito inteiro | Postgres com escrita granular |
| Branding | fixo | white-label por grupo |

## A dor que segura o produto de pé

O sorteio equilibrado. É a única parte que o organizador não consegue fazer na
mão sem brigar com alguém, e é o que faz o grupo abrir o app toda semana. Por
isso ele é uma função pura, testada, com semente reproduzível: quando alguém
reclamar do time, dá para repetir o sorteio e provar que não teve marmelada.

## Estado atual

Fases 1 a 3 entregues e rodando sobre um adapter local; Fase 4 com o domínio de
cobrança pronto e testado, faltando o gateway; Fase 5 com o importador do dump
antigo pronto. Ver `11-roadmap.md`.
