#!/usr/bin/env node
/**
 * Fase 5 da spec: le o JSON exportado do app antigo (`{ players, matches }`) e
 * emite o SQL de carga para o schema novo.
 *
 *   node scripts/import-legacy.mjs seed/demo.json --slug pmnh --name "PMNH & Amigos" > carga.sql
 *
 * Faca o backup ANTES do plano do Azure expirar: `GET /api/data` esta aberto,
 * basta salvar o JSON.
 */
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}

if (!file) {
  console.error('uso: node scripts/import-legacy.mjs <dump.json> [--slug pmnh] [--name "PMNH & Amigos"]')
  process.exit(1)
}

const slug = opt('slug', 'pmnh')
const name = opt('name', 'PMNH & Amigos')
const tagline = opt('tagline', '')
const tenantId = opt('tenant-id', randomUUID())

const dump = JSON.parse(readFileSync(file, 'utf8'))
const players = dump.players ?? []
const matches = dump.matches ?? []

/** UUID deterministico a partir do id antigo: reimportar nao duplica. */
function uuidFor(kind, legacyId) {
  const h = createHash('sha1').update(`${tenantId}:${kind}:${legacyId}`).digest('hex')
  const b = h.slice(0, 32).split('')
  b[12] = '5' // versao 5
  b[16] = ((parseInt(b[16], 16) & 0x3) | 0x8).toString(16)
  const s = b.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v == null || v === '' ? 'null' : Number(v))
const b = (v) => (v ? 'true' : 'false')

const POS = new Set(['GOL', 'ZAG', 'VOL', 'MC', 'ATA'])
const pos = (p) => (POS.has(String(p ?? '').toUpperCase()) ? String(p).toUpperCase() : null)

const out = []
out.push('-- Gerado por scripts/import-legacy.mjs. Rode dentro de uma transacao.')
out.push('begin;')
out.push('')
out.push(`insert into tenants (id, slug, name, tagline) values (${q(tenantId)}, ${q(slug)}, ${q(name)}, ${q(tagline || null)})`)
out.push('  on conflict (slug) do nothing;')
out.push('')
out.push(`insert into subscriptions (tenant_id, plan_code, status, billing_mode, payment_method_on_file)`)
out.push(`  values (${q(tenantId)}, 'free', 'trialing', 'trial', false) on conflict (tenant_id) do nothing;`)
out.push('')

out.push('-- jogadores')
for (const p of players) {
  const id = uuidFor('player', p.id)
  out.push(
    `insert into players (id, tenant_id, name, pos, photo_url, is_app, legacy_id) values (` +
      `${q(id)}, ${q(tenantId)}, ${q(p.name)}, ${q(pos(p.pos))}, ${q(p.photo ?? null)}, ${b(p.app)}, ${q(p.id)})` +
      ` on conflict (id) do nothing;`,
  )
}
out.push('')

const formOf = (f) => (f ? `${f.ZAG ?? 0}-${f.VOL ?? 0}-${f.MC ?? 0}-${f.ATA ?? 0}` : null)

out.push('-- partidas')
for (const m of matches) {
  const id = uuidFor('match', m.id)
  const status = m.pending ? 'pending' : 'finished'
  const craque = m.craque ? q(uuidFor('player', m.craque)) : 'null'
  const voteState = m.voteOpen ? 'open' : m.voteClosed ? 'closed' : 'auto'
  out.push(
    `insert into matches (id, tenant_id, date, status, score_a, score_b, lineup_published, vote_state, craque_player_id, formation_a, formation_b) values (` +
      `${q(id)}, ${q(tenantId)}, ${q(m.date)}, ${q(status)}, ${n(m.scoreBranco)}, ${n(m.scorePreto)}, ` +
      `${b(m.escalaPub !== false)}, ${q(voteState)}, ${craque}, ${q(formOf(m.lineup?.formB))}, ${q(formOf(m.lineup?.formP))})` +
      ` on conflict (id) do nothing;`,
  )

  // slot / titularidade / nota congelada saem da escalacao daquela partida
  const meta = new Map()
  for (const team of ['branco', 'preto']) {
    const t = m.lineup?.teams?.[team]
    if (!t) continue
    if (t.gk) meta.set(t.gk.id, { slot: 'GOL', starter: true, oop: false, rating: t.gk.rating })
    for (const p of t.line ?? []) {
      meta.set(p.id, { slot: pos(p.slot) ?? pos(p.pos), starter: true, oop: !!p.oop, rating: p.rating })
    }
    for (const p of t.res ?? []) {
      meta.set(p.id, { slot: pos(p.slot) ?? pos(p.pos), starter: false, oop: !!p.oop, rating: p.rating })
    }
  }

  for (const e of m.entries ?? []) {
    const mt = meta.get(e.playerId) ?? {}
    out.push(
      `insert into match_entries (match_id, player_id, team, slot, is_starter, out_of_position, rating_at_draw, result, goals, own_goals) values (` +
        `${q(id)}, ${q(uuidFor('player', e.playerId))}, ${q(e.team === 'preto' ? 'b' : 'a')}, ${q(mt.slot ?? null)}, ` +
        `${b(mt.starter !== false)}, ${b(mt.oop)}, ${n(mt.rating)}, ${q(e.result ?? null)}, ${n(e.goals ?? 0)}, ${n(e.og ?? 0)})` +
        ` on conflict (match_id, player_id) do nothing;`,
    )
  }

  // votos antigos vem agregados por jogador, sem identidade do votante:
  // preservamos como votos "legacy-N" para nao perder a apuracao
  let k = 0
  for (const [playerId, count] of Object.entries(m.votes ?? {})) {
    for (let i = 0; i < count; i++) {
      out.push(
        `insert into craque_votes (match_id, voter_key, player_id) values (` +
          `${q(id)}, ${q(`legacy-${k++}`)}, ${q(uuidFor('player', playerId))}) on conflict do nothing;`,
      )
    }
  }
  out.push('')
}

out.push('commit;')
console.log(out.join('\n'))
console.error(
  `ok: tenant ${slug} (${tenantId}), ${players.length} jogadores, ${matches.length} partidas`,
)
