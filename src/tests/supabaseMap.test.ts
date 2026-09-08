import { describe, expect, it } from 'vitest'
import {
  brandingToRow,
  entryFromRow,
  entryToRow,
  formationToText,
  lineupSlotOf,
  matchFromRow,
  playerFromRow,
  playerPatchToRow,
  resultFor,
  statusOf,
  subscriptionFromRow,
  teamFromDb,
  teamToDb,
  tenantFromRow,
  voteStateToRow,
  type EntryRow,
  type MatchRow,
  type PlayerRow,
  type SubscriptionRow,
  type TenantRow,
} from '../data/supabaseMap'
import type { Lineup } from '../domain/types'

const tenantRow = (over: Partial<TenantRow> = {}): TenantRow => ({
  id: 't1',
  slug: 'demo',
  name: 'Futebol da Galera',
  tagline: 'Confusão, Cultura e Ladaia',
  logo_url: null,
  primary_color: '#22c55e',
  instagram_url: null,
  timezone: 'America/Sao_Paulo',
  team_a_name: 'Branco',
  team_b_name: 'Preto',
  team_colors: null,
  positions: null,
  ...over,
})

const playerRow = (over: Partial<PlayerRow> = {}): PlayerRow => ({
  id: 'p1',
  tenant_id: 't1',
  name: 'Bonato',
  pos: 'MC',
  photo_url: null,
  is_monthly: true,
  is_app: false,
  created_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  ...over,
})

const matchRow = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: 'm1',
  tenant_id: 't1',
  date: '2026-08-26',
  season: '2026',
  status: 'finished',
  score_a: 3,
  score_b: 2,
  lineup_published: true,
  vote_state: 'auto',
  vote_opened_at: null,
  craque_player_id: null,
  formation_a: null,
  formation_b: null,
  draw_seed: null,
  lineup: null,
  ...over,
})

const entryRow = (over: Partial<EntryRow> = {}): EntryRow => ({
  match_id: 'm1',
  player_id: 'p1',
  team: 'a',
  slot: 'MC',
  is_starter: true,
  out_of_position: false,
  rating_at_draw: 62.5,
  result: 'v',
  goals: 2,
  own_goals: 0,
  ...over,
})

const lineup = (): Lineup => ({
  formB: { ZAG: 2, VOL: 1, MC: 2, ATA: 1 },
  formP: { ZAG: 2, VOL: 1, MC: 1, ATA: 2 },
  seed: 4242,
  teams: {
    branco: {
      gk: { id: 'gk1', name: 'GK1', pos: 'GOL', rating: 50, avulso: false, slot: 'GOL' },
      line: [{ id: 'p1', name: 'Bonato', pos: 'MC', rating: 62.5, avulso: false, slot: 'MC' }],
      res: [{ id: 'r1', name: 'Reserva', pos: 'ATA', rating: 40, avulso: false, slot: 'ATA', oop: true }],
      total: 152.5,
    },
    preto: {
      gk: { id: 'gk2', name: 'GK2', pos: 'GOL', rating: 50, avulso: false, slot: 'GOL' },
      line: [{ id: 'av-1', name: 'Avulso', pos: 'ATA', rating: 45, avulso: true, slot: 'ATA' }],
      res: [],
      total: 95,
    },
  },
})

describe('time: branco/preto <-> a/b', () => {
  it('vai e volta sem perder o lado', () => {
    expect(teamToDb('branco')).toBe('a')
    expect(teamToDb('preto')).toBe('b')
    expect(teamFromDb(teamToDb('branco'))).toBe('branco')
    expect(teamFromDb(teamToDb('preto'))).toBe('preto')
  })
})

describe('resultFor', () => {
  it('deriva vitoria, derrota e empate do placar', () => {
    expect(resultFor('branco', 3, 2)).toBe('v')
    expect(resultFor('preto', 3, 2)).toBe('d')
    expect(resultFor('branco', 2, 3)).toBe('d')
    expect(resultFor('preto', 2, 3)).toBe('v')
    expect(resultFor('branco', 2, 2)).toBe('e')
  })

  it('trata placar ausente como empate, sem quebrar', () => {
    expect(resultFor('branco', null, null)).toBe('e')
    expect(resultFor('preto', 3, null)).toBe('e')
  })
})

describe('tenant', () => {
  it('monta o branding a partir da linha', () => {
    const t = tenantFromRow(tenantRow())
    expect(t.id).toBe('t1')
    expect(t.slug).toBe('demo')
    expect(t.branding.teamNames).toEqual({ branco: 'Branco', preto: 'Preto' })
    expect(t.branding.primaryColor).toBe('#22c55e')
    // sem coluna preenchida, a chave nem aparece: o default do dominio vale
    expect(t.branding.teamColors).toBeUndefined()
    expect(t.branding.positions).toBeUndefined()
  })

  it('traz cores e posicoes do grupo quando existem', () => {
    const t = tenantFromRow(
      tenantRow({
        team_colors: { branco: '#fff', preto: '#000' },
        positions: [{ code: 'ALA', base: 'MC' }],
      }),
    )
    expect(t.branding.teamColors).toEqual({ branco: '#fff', preto: '#000' })
    expect(t.branding.positions).toEqual([{ code: 'ALA', base: 'MC' }])
  })

  it('so manda para o banco o campo que veio no patch', () => {
    expect(brandingToRow({ name: 'Novo' })).toEqual({ name: 'Novo' })
    expect(brandingToRow({ teamNames: { branco: 'Verde', preto: 'Azul' } })).toEqual({
      team_a_name: 'Verde',
      team_b_name: 'Azul',
    })
    expect(brandingToRow({})).toEqual({})
  })
})

describe('jogador', () => {
  it('mapeia a linha para o dominio', () => {
    const p = playerFromRow(playerRow({ is_app: true, deleted_at: '2026-02-01T00:00:00Z' }))
    expect(p).toMatchObject({
      id: 'p1',
      tenantId: 't1',
      name: 'Bonato',
      pos: 'MC',
      app: true,
      isMonthly: true,
      deletedAt: '2026-02-01T00:00:00Z',
    })
  })

  it('aceita posicao criada pelo grupo', () => {
    expect(playerFromRow(playerRow({ pos: 'ALA' })).pos).toBe('ALA')
  })

  it('converte so o que o patch trouxe', () => {
    expect(playerPatchToRow({ pos: 'ATA' })).toEqual({ pos: 'ATA' })
    expect(playerPatchToRow({ photoUrl: null })).toEqual({ photo_url: null })
    expect(playerPatchToRow({})).toEqual({})
  })
})

describe('status da partida', () => {
  it('pendente manda, depois o placar decide', () => {
    expect(statusOf(true, true)).toBe('pending')
    expect(statusOf(true, false)).toBe('pending')
    expect(statusOf(false, true)).toBe('finished')
    expect(statusOf(undefined, false)).toBe('draft')
  })
})

describe('estado da votacao', () => {
  it('carimba a abertura e limpa no fechamento', () => {
    const now = '2026-08-26T22:00:00.000Z'
    expect(voteStateToRow('open', now)).toEqual({ vote_state: 'open', vote_opened_at: now })
    expect(voteStateToRow('closed', now)).toEqual({ vote_state: 'closed', vote_opened_at: null })
    expect(voteStateToRow('auto', now)).toEqual({ vote_state: 'auto', vote_opened_at: null })
  })
})

describe('formacao', () => {
  it('escreve na ordem ZAG-VOL-MC-ATA', () => {
    expect(formationToText({ ZAG: 2, VOL: 1, MC: 2, ATA: 1 })).toBe('2-1-2-1')
    expect(formationToText(undefined)).toBeNull()
  })
})

describe('escalacao -> linha de entrada', () => {
  it('acha titular, reserva e fora de posicao no blob', () => {
    const l = lineup()
    expect(lineupSlotOf(l, 'p1')).toEqual({ slot: 'MC', starter: true, oop: false, rating: 62.5 })
    expect(lineupSlotOf(l, 'r1')).toEqual({ slot: 'ATA', starter: false, oop: true, rating: 40 })
    expect(lineupSlotOf(l, 'gk1')).toEqual({ slot: 'GOL', starter: true, oop: false, rating: 50 })
    expect(lineupSlotOf(l, 'ninguem')).toBeNull()
    expect(lineupSlotOf(null, 'p1')).toBeNull()
  })

  it('congela slot e nota do sorteio na linha', () => {
    const row = entryToRow('m1', { playerId: 'p1', team: 'branco', result: 'v', goals: 2 }, lineup())
    expect(row).toEqual({
      match_id: 'm1',
      player_id: 'p1',
      team: 'a',
      slot: 'MC',
      is_starter: true,
      out_of_position: false,
      rating_at_draw: 62.5,
      result: 'v',
      goals: 2,
      own_goals: 0,
    })
  })

  it('sem escalacao trata como titular sem nota congelada', () => {
    const row = entryToRow('m1', { playerId: 'p9', team: 'preto', result: 'd', goals: 0, og: 1 }, null)
    expect(row).toMatchObject({ team: 'b', slot: null, is_starter: true, rating_at_draw: null, own_goals: 1 })
  })
})

describe('linha de entrada -> dominio', () => {
  it('traduz o time e preserva gols', () => {
    expect(entryFromRow(entryRow(), 3, 2)).toEqual({
      playerId: 'p1',
      team: 'branco',
      result: 'v',
      goals: 2,
      og: 0,
    })
  })

  it('deriva o resultado quando a coluna esta nula', () => {
    expect(entryFromRow(entryRow({ result: null, team: 'b' }), 3, 2).result).toBe('d')
  })
})

describe('partida completa', () => {
  it('monta o Match com entradas e apuracao', () => {
    const m = matchFromRow(matchRow(), [entryRow()], { p1: 4 })
    expect(m).toMatchObject({
      id: 'm1',
      tenantId: 't1',
      date: '2026-08-26',
      pending: false,
      scoreBranco: 3,
      scorePreto: 2,
      escalaPub: true,
      votes: { p1: 4 },
      season: '2026',
    })
    expect(m.entries).toHaveLength(1)
    expect(m.entries[0].team).toBe('branco')
  })

  it('traduz vote_state para as flags do dominio', () => {
    expect(matchFromRow(matchRow({ vote_state: 'open' }), [], {}).voteOpen).toBe(true)
    expect(matchFromRow(matchRow({ vote_state: 'open' }), [], {}).voteClosed).toBeUndefined()
    expect(matchFromRow(matchRow({ vote_state: 'closed' }), [], {}).voteClosed).toBe(true)
    expect(matchFromRow(matchRow({ vote_state: 'auto' }), [], {}).voteOpen).toBeUndefined()
  })

  it('marca pendente e aceita partida sem placar, sem escalacao e sem jogador', () => {
    const m = matchFromRow(matchRow({ status: 'pending', score_a: null, score_b: null }), [], {})
    expect(m.pending).toBe(true)
    expect(m.scoreBranco).toBeNull()
    expect(m.entries).toEqual([])
    expect(m.lineup).toBeNull()
  })

  it('cai para o ano da data quando a temporada nao vem', () => {
    expect(matchFromRow(matchRow({ season: null }), [], {}).season).toBe('2026')
  })
})

describe('assinatura', () => {
  it('mapeia a linha sem inventar valor', () => {
    const row: SubscriptionRow = {
      tenant_id: 't1',
      plan_code: 'liga',
      status: 'trialing',
      billing_mode: 'trial',
      payment_method_on_file: true,
      trial_ends_at: '2026-12-01T00:00:00Z',
      current_period_end: null,
    }
    expect(subscriptionFromRow(row)).toEqual({
      tenantId: 't1',
      planCode: 'liga',
      status: 'trialing',
      billingMode: 'trial',
      paymentMethodOnFile: true,
      trialEndsAt: '2026-12-01T00:00:00Z',
      currentPeriodEnd: null,
    })
  })
})
