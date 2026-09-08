#!/usr/bin/env node
/**
 * Fase 5 da spec: le o JSON exportado do app antigo (`{ players, matches }`) e
 * emite o SQL de carga para o schema novo.
 *
 *   node scripts/import-legacy.mjs dump.json --slug pmnh --name "PMNH & Amigos" > carga.sql
 *
 * Faca o backup ANTES do plano do Azure expirar: `GET /api/data` esta aberto,
 * basta salvar o JSON.
 *
 * As funcoes puras ficam exportadas para o teste (`src/tests/importLegacy.test.ts`);
 * so o rodape deste arquivo lê argumento e escreve na saida.
 */
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

// --------------------------------------------------------------- primitivas

/** Literal SQL. Aspas simples no nome do jogador nao viram injecao. */
export const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
export const num = (v) => (v == null || v === '' ? 'null' : Number(v))
export const bool = (v) => (v ? 'true' : 'false')

const BASE = new Set(['GOL', 'ZAG', 'VOL', 'MC', 'ATA'])

/**
 * Slot da escalacao: so os cinco papeis base. Formacao e sorteio nao sabem
 * trabalhar com outra coisa.
 */
export const slotOf = (p) => {
  const s = String(p ?? '').toUpperCase()
  return BASE.has(s) ? s : null
}

/**
 * Posicao do cadastro. Diferente do slot: o grupo pode ter criado a propria
 * (ALA, LIB) pelo branding, e a migration 0003 tirou o check que barrava isso.
 * Perder o rotulo do grupo na importacao seria perder dado de propósito.
 */
export const posOf = (p) => {
  const s = String(p ?? '').trim().toUpperCase()
  return s || null
}

/** "2-1-2-1", para as colunas de auditoria formation_a/formation_b. */
export const formationText = (f) => (f ? `${f.ZAG ?? 0}-${f.VOL ?? 0}-${f.MC ?? 0}-${f.ATA ?? 0}` : null)

/**
 * UUID deterministico a partir do **slug** e do id antigo.
 *
 * Deriva do slug, e nao do id do tenant, de proposito: se o grupo ja existir no
 * banco, o id dele e outro, e derivar dali faria a segunda importacao gerar
 * UUIDs diferentes dos da primeira — duplicando tudo em vez de ser idempotente.
 */
export function uuidFor(slug, kind, legacyId) {
  const h = createHash('sha1').update(`${slug}:${kind}:${legacyId}`).digest('hex')
  const b = h.slice(0, 32).split('')
  b[12] = '5' // versao 5
  b[16] = ((parseInt(b[16], 16) & 0x3) | 0x8).toString(16)
  const s = b.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

/** Jogador efemero do sorteio: existe so na escalacao, nunca no elenco. */
export const isAvulso = (id) => String(id).startsWith('av-')

/**
 * Ids citados nas partidas que nao existem na lista de jogadores. A FK
 * `match_entries.player_id` estouraria no meio da carga; melhor saber antes.
 */
export function orphanIds(dump) {
  const conhecidos = new Set((dump.players ?? []).map((p) => p.id))
  const orfaos = new Set()
  for (const m of dump.matches ?? []) {
    for (const e of m.entries ?? []) {
      if (!conhecidos.has(e.playerId) && !isAvulso(e.playerId)) orfaos.add(e.playerId)
    }
  }
  return [...orfaos]
}

/**
 * Reescreve os ids de jogador dentro do blob da escalacao para os UUIDs novos.
 * Avulso fica como esta: ele nao tem linha em `players` para apontar.
 */
export function remapLineup(lineup, slug) {
  if (!lineup) return null
  const swap = (p) => (p ? { ...p, id: isAvulso(p.id) ? p.id : uuidFor(slug, 'player', p.id) } : p)
  const teams = {}
  for (const key of ['branco', 'preto']) {
    const side = lineup.teams?.[key]
    if (!side) continue
    teams[key] = {
      ...side,
      gk: side.gk ? swap(side.gk) : null,
      line: (side.line ?? []).map(swap),
      res: (side.res ?? []).map(swap),
    }
  }
  return { ...lineup, teams }
}

/** slot / titularidade / nota congelada, lidos da escalacao daquela partida. */
export function lineupMeta(lineup) {
  const meta = new Map()
  for (const team of ['branco', 'preto']) {
    const t = lineup?.teams?.[team]
    if (!t) continue
    if (t.gk) meta.set(t.gk.id, { slot: 'GOL', starter: true, oop: false, rating: t.gk.rating })
    for (const p of t.line ?? []) {
      meta.set(p.id, { slot: slotOf(p.slot) ?? slotOf(p.pos), starter: true, oop: !!p.oop, rating: p.rating })
    }
    for (const p of t.res ?? []) {
      meta.set(p.id, { slot: slotOf(p.slot) ?? slotOf(p.pos), starter: false, oop: !!p.oop, rating: p.rating })
    }
  }
  return meta
}

// ------------------------------------------------------------------ gerador

/**
 * Monta o SQL de carga. Funcao pura: recebe o dump ja lido e devolve string.
 *
 * O `tenant_id` de toda linha sai de um `select ... from tenants where slug =`,
 * nunca do literal: se o grupo ja existir, o `on conflict (slug) do nothing`
 * mantem o id antigo, e cravar o id novo nas outras tabelas deixaria tudo
 * apontando para um tenant que nao foi criado.
 */
export function buildCarga(dump, { slug, name, tagline = null, tenantId = randomUUID() }) {
  const players = dump.players ?? []
  const matches = dump.matches ?? []
  const conhecidos = new Set(players.map((p) => p.id))
  const uid = (kind, id) => uuidFor(slug, kind, id)
  const TENANT = `(select id from tenants where slug = ${q(slug)})`

  const out = []
  out.push('-- Gerado por scripts/import-legacy.mjs. Rode dentro de uma transacao.')
  out.push('begin;')
  out.push('')
  out.push(
    `insert into tenants (id, slug, name, tagline) values (${q(tenantId)}, ${q(slug)}, ${q(name)}, ${q(tagline)})`,
  )
  out.push('  on conflict (slug) do nothing;')
  out.push('')
  out.push('insert into subscriptions (tenant_id, plan_code, status, billing_mode, payment_method_on_file)')
  out.push(`  select id, 'free', 'trialing', 'trial', false from tenants where slug = ${q(slug)}`)
  out.push('  on conflict (tenant_id) do nothing;')
  out.push('')

  out.push('-- jogadores')
  for (const p of players) {
    out.push(
      `insert into players (id, tenant_id, name, pos, photo_url, is_app, is_monthly, legacy_id, deleted_at) ` +
        `select ${q(uid('player', p.id))}, id, ${q(p.name)}, ${q(posOf(p.pos))}, ` +
        `${q(p.photoUrl ?? p.photo ?? null)}, ${bool(p.app)}, ${bool(p.isMonthly !== false)}, ` +
        `${q(p.id)}, ${q(p.deletedAt ?? null)} from tenants where slug = ${q(slug)} ` +
        `on conflict (id) do nothing;`,
    )
  }
  out.push('')

  out.push('-- partidas')
  for (const m of matches) {
    const id = uid('match', m.id)
    const temPlacar = m.scoreBranco != null && m.scorePreto != null
    const status = m.pending ? 'pending' : temPlacar ? 'finished' : 'draft'
    const craque = m.craque ? q(uid('player', m.craque)) : 'null'
    const voteState = m.voteOpen ? 'open' : m.voteClosed ? 'closed' : 'auto'
    const voteOpenedAt = voteState === 'open' && m.voteOpenedAt ? q(m.voteOpenedAt) : 'null'
    // A escalacao inteira vai para a coluna jsonb: e la que a UI le, e o avulso
    // do sorteio nao cabe em match_entries por causa da FK de player_id.
    const lineup = remapLineup(m.lineup ?? null, slug)
    const lineupSql = lineup ? `${q(JSON.stringify(lineup))}::jsonb` : 'null'

    out.push(
      `insert into matches (id, tenant_id, date, status, score_a, score_b, lineup_published, ` +
        `vote_state, vote_opened_at, craque_player_id, formation_a, formation_b, draw_seed, lineup) ` +
        `select ${q(id)}, t.id, ${q(m.date)}, ${q(status)}, ${num(m.scoreBranco)}, ${num(m.scorePreto)}, ` +
        `${bool(m.escalaPub !== false)}, ${q(voteState)}, ${voteOpenedAt}, ${craque}, ` +
        `${q(formationText(m.lineup?.formB))}, ${q(formationText(m.lineup?.formP))}, ` +
        `${num(m.lineup?.seed)}, ${lineupSql} from tenants t where t.slug = ${q(slug)} ` +
        `on conflict (id) do nothing;`,
    )

    const meta = lineupMeta(m.lineup)
    for (const e of m.entries ?? []) {
      // avulso e id desconhecido nao viram linha: a FK de player_id estouraria
      if (isAvulso(e.playerId) || !conhecidos.has(e.playerId)) continue
      const mt = meta.get(e.playerId) ?? {}
      out.push(
        `insert into match_entries (match_id, player_id, team, slot, is_starter, out_of_position, ` +
          `rating_at_draw, result, goals, own_goals) values (` +
          `${q(id)}, ${q(uid('player', e.playerId))}, ${q(e.team === 'preto' ? 'b' : 'a')}, ` +
          `${q(mt.slot ?? null)}, ${bool(mt.starter !== false)}, ${bool(mt.oop)}, ${num(mt.rating)}, ` +
          `${q(e.result ?? null)}, ${num(e.goals ?? 0)}, ${num(e.og ?? 0)})` +
          ` on conflict (match_id, player_id) do nothing;`,
      )
    }

    // votos antigos vem agregados por jogador, sem identidade do votante:
    // preservamos como votos "legacy-N" para nao perder a apuracao
    let k = 0
    for (const [playerId, count] of Object.entries(m.votes ?? {})) {
      if (!conhecidos.has(playerId)) continue
      for (let i = 0; i < count; i++) {
        out.push(
          `insert into craque_votes (match_id, voter_key, player_id) values (` +
            `${q(id)}, ${q(`legacy-${k++}`)}, ${q(uid('player', playerId))}) on conflict do nothing;`,
        )
      }
    }
    out.push('')
  }

  out.push('commit;')
  return out.join('\n')
}

// --------------------------------------------------------------------- CLI

const executadoDireto = process.argv[1] && process.argv[1].endsWith('import-legacy.mjs')

if (executadoDireto) {
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith('--'))
  const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : fallback
  }

  if (!file) {
    console.error(
      'uso: node scripts/import-legacy.mjs <dump.json> [--slug pmnh] [--name "PMNH & Amigos"]\n' +
        '     [--tagline "..."] [--tenant-id <uuid>] [--ignorar-orfaos]',
    )
    process.exit(1)
  }

  const slug = opt('slug', 'pmnh')
  const dump = JSON.parse(readFileSync(file, 'utf8'))
  const orfaos = orphanIds(dump)

  // Id citado numa partida e ausente do elenco quebraria a FK no meio da carga.
  // Melhor parar aqui, com a lista na mao, do que descobrir com o banco pela
  // metade — e quem quiser seguir assim mesmo diz isso explicitamente.
  if (orfaos.length > 0 && !args.includes('--ignorar-orfaos')) {
    console.error(
      `erro: ${orfaos.length} jogador(es) citado(s) em partidas nao existe(m) no elenco do dump:\n` +
        `  ${orfaos.slice(0, 20).join(', ')}${orfaos.length > 20 ? ', ...' : ''}\n` +
        'Corrija o dump, ou rode de novo com --ignorar-orfaos para deixar essas participacoes de fora.',
    )
    process.exit(1)
  }
  if (orfaos.length > 0) {
    console.error(`aviso: ${orfaos.length} jogador(es) desconhecido(s) ficaram de fora das partidas.`)
  }

  console.log(
    buildCarga(dump, {
      slug,
      name: opt('name', 'PMNH & Amigos'),
      tagline: opt('tagline', '') || null,
      tenantId: opt('tenant-id', randomUUID()),
    }),
  )

  const comEscalacao = (dump.matches ?? []).filter((m) => m.lineup).length
  console.error(
    `ok: tenant ${slug}, ${(dump.players ?? []).length} jogadores, ` +
      `${(dump.matches ?? []).length} partidas, ${comEscalacao} com escalacao`,
  )
}
