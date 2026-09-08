import { describe, expect, it } from 'vitest'
import { craqueState, eligibleForCraque, msUntilClose, tallyVotes, zonedNow } from '../domain/craque'
import type { Lineup, Match } from '../domain/types'

const TZ = 'America/Sao_Paulo'

const lineup = (): Lineup => ({
  formB: { ZAG: 2, VOL: 1, MC: 2, ATA: 1 },
  formP: { ZAG: 2, VOL: 1, MC: 2, ATA: 1 },
  teams: {
    branco: {
      gk: { id: 'gk1', name: 'GK1', pos: 'GOL', rating: 50, avulso: false, slot: 'GOL' },
      line: [{ id: 'b1', name: 'B1', pos: 'ZAG', rating: 50, avulso: false, slot: 'ZAG' }],
      res: [{ id: 'br1', name: 'BR1', pos: 'MC', rating: 50, avulso: false, slot: 'MC' }],
      total: 100,
    },
    preto: {
      gk: { id: 'gk2', name: 'GK2', pos: 'GOL', rating: 50, avulso: false, slot: 'GOL' },
      line: [{ id: 'p1', name: 'P1', pos: 'ATA', rating: 50, avulso: false, slot: 'ATA' }],
      res: [],
      total: 50,
    },
  },
})

const match = (over: Partial<Match> = {}): Match => ({
  id: 'm', tenantId: 't', date: '2026-08-26', scoreBranco: 3, scorePreto: 2,
  entries: [], lineup: lineup(), votes: {}, ...over,
})

/** 26/08/2026 as HH:MM em Sao Paulo (UTC-3). */
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 26, h + 3, m))

describe('janela automatica: abre 21:30 e dura 30 min', () => {
  it('antes das 21:30 no dia da partida: before', () => {
    expect(craqueState(match(), at(21, 29), TZ)).toBe('before')
  })

  it('as 21:30 em ponto: aberta', () => {
    expect(craqueState(match(), at(21, 30), TZ)).toBe('open')
  })

  it('as 21:59: ainda aberta', () => {
    expect(craqueState(match(), at(21, 59), TZ)).toBe('open')
  })

  it('as 22:00: fecha sozinha, 30 min depois da abertura', () => {
    expect(craqueState(match(), at(22, 0), TZ)).toBe('closed')
  })

  it('dia anterior: before; dia seguinte: closed', () => {
    expect(craqueState(match(), new Date('2026-08-25T23:00:00Z'), TZ)).toBe('before')
    expect(craqueState(match(), new Date('2026-08-27T15:00:00Z'), TZ)).toBe('closed')
  })

  it('msUntilClose conta ate as 22:00', () => {
    expect(msUntilClose(match(), at(21, 40), TZ)).toBe(20 * 60_000)
  })
})

describe('abertura manual do admin', () => {
  const openedAt = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 26, h + 3, m)).toISOString()

  it('abre fora da janela automatica', () => {
    expect(craqueState(match({ voteOpen: true, voteOpenedAt: openedAt(10) }), at(10, 5), TZ)).toBe('open')
  })

  it('continua aberta ate 29 min depois da abertura', () => {
    const m = match({ voteOpen: true, voteOpenedAt: openedAt(10) })
    expect(craqueState(m, at(10, 29), TZ)).toBe('open')
  })

  it('fecha sozinha 30 min depois da abertura', () => {
    const m = match({ voteOpen: true, voteOpenedAt: openedAt(10) })
    expect(craqueState(m, at(10, 30), TZ)).toBe('closed')
    expect(craqueState(m, at(11, 0), TZ)).toBe('closed')
  })

  it('msUntilClose conta a partir do carimbo da abertura', () => {
    const m = match({ voteOpen: true, voteOpenedAt: openedAt(10) })
    expect(msUntilClose(m, at(10, 12), TZ)).toBe(18 * 60_000)
  })

  it('dado antigo sem carimbo fica aberto ate o admin encerrar', () => {
    const m = match({ voteOpen: true })
    expect(craqueState(m, at(10), TZ)).toBe('open')
    expect(craqueState(m, at(23, 59), TZ)).toBe('open')
    expect(msUntilClose(m, at(10), TZ)).toBeNull()
  })

  it('voteClosed encerra na hora, antes dos 30 min', () => {
    const m = match({ voteOpen: true, voteOpenedAt: openedAt(21, 30), voteClosed: true })
    expect(craqueState(m, at(21, 45), TZ)).toBe('closed')
  })

  it('voteClosed encerra dentro da janela automatica', () => {
    expect(craqueState(match({ voteClosed: true }), at(21, 45), TZ)).toBe('closed')
  })

  it('craque definido finaliza acima de tudo', () => {
    expect(craqueState(match({ craque: 'b1', voteOpen: true }), at(21, 45), TZ)).toBe('finalized')
  })
})

describe('elegiveis', () => {
  it('inclui titulares, goleiros e reservas dos dois times', () => {
    const ids = eligibleForCraque(match()).map((e) => e.id).sort()
    expect(ids).toEqual(['b1', 'br1', 'gk1', 'gk2', 'p1'])
  })

  it('marca quem e reserva', () => {
    const e = eligibleForCraque(match())
    expect(e.find((x) => x.id === 'br1')?.starter).toBe(false)
    expect(e.find((x) => x.id === 'gk1')?.starter).toBe(true)
  })

  it('sem escalacao, ninguem e elegivel', () => {
    expect(eligibleForCraque(match({ lineup: null }))).toEqual([])
  })
})

describe('apuracao', () => {
  it('ordena por votos e calcula o percentual', () => {
    const { rows, total, leaders } = tallyVotes(match({ votes: { a: 2, b: 6, c: 2 } }))
    expect(total).toBe(10)
    expect(rows[0]).toMatchObject({ id: 'b', votes: 6, pct: 60 })
    expect(leaders).toEqual(['b'])
  })

  it('empate devolve os dois lideres, para o admin cravar', () => {
    expect(tallyVotes(match({ votes: { a: 3, b: 3 } })).leaders.sort()).toEqual(['a', 'b'])
  })

  it('sem voto, sem lider', () => {
    expect(tallyVotes(match()).leaders).toEqual([])
  })
})

describe('zonedNow', () => {
  it('converte para o fuso do grupo', () => {
    const z = zonedNow(new Date('2026-08-27T01:00:00Z'), TZ)
    expect(z.date).toBe('2026-08-26')
    expect(z.minutes).toBe(22 * 60)
  })
})
