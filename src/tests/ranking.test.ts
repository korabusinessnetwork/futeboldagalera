import { describe, expect, it } from 'vitest'
import { assignRanks, buildRanking, buildScorers } from '../domain/ranking'
import { computeStats } from '../domain/stats'
import type { Match, Player } from '../domain/types'

const P = (id: string, name: string): Player => ({ id, tenantId: 't', name, pos: 'MC' })

function match(id: string, rows: Array<[string, 'v' | 'e' | 'd', number]>, pending = false): Match {
  return {
    id,
    tenantId: 't',
    date: '2026-01-01',
    pending,
    scoreBranco: 1,
    scorePreto: 0,
    entries: rows.map(([playerId, result, goals]) => ({ playerId, team: 'branco', result, goals })),
  }
}

describe('pontuacao e aproveitamento', () => {
  it('vale 4 pela vitoria, 2 pelo empate, 1 pela derrota; gol nao pontua', () => {
    const players = [P('a', 'Ana'), P('b', 'Bia')]
    const matches = [
      match('m1', [['a', 'v', 3], ['b', 'd', 0]]),
      match('m2', [['a', 'e', 0], ['b', 'v', 0]]),
    ]
    const stats = computeStats(players, matches)
    const ana = stats.find((s) => s.id === 'a')!
    expect(ana.pts).toBe(6)
    expect(ana.goals).toBe(3)
    // aproveitamento = pontos / (jogos * 4) * 100
    expect(ana.pct).toBeCloseTo((6 / 8) * 100, 6)
  })

  it('ignora partidas pendentes', () => {
    const stats = computeStats([P('a', 'Ana')], [match('m1', [['a', 'v', 1]], true)])
    expect(stats[0].games).toBe(0)
  })

  it('esconde quem nao jogou', () => {
    const rows = buildRanking(computeStats([P('a', 'Ana'), P('b', 'Bia')], [match('m1', [['a', 'v', 0]])]))
    expect(rows.map((r) => r.id)).toEqual(['a'])
  })

  it('ignora o pseudo-jogador "Goleiro App"', () => {
    const players: Player[] = [P('a', 'Ana'), { ...P('app', 'Goleiro App'), app: true }]
    const stats = computeStats(players, [match('m1', [['a', 'v', 0], ['app', 'v', 0]])])
    expect(stats.map((s) => s.id)).toEqual(['a'])
  })
})

describe('assignRanks', () => {
  it('empate real divide a mesma posicao e pula a seguinte', () => {
    const rows = [{ pts: 8 }, { pts: 4 }, { pts: 4 }, { pts: 1 }]
    expect(assignRanks(rows, ['pts']).map((r) => r.rank)).toEqual([1, 2, 2, 4])
  })

  it('so empata quando TODAS as chaves batem', () => {
    const rows = [
      { pts: 4, v: 1 },
      { pts: 4, v: 0 },
    ]
    expect(assignRanks(rows, ['pts', 'v']).map((r) => r.rank)).toEqual([1, 2])
  })
})

describe('ordenacao', () => {
  it('desempata por pts, vitorias, aproveitamento, jogos, nome', () => {
    const players = [P('a', 'Zeca'), P('b', 'Ana')]
    // ambos 1 vitoria em 1 jogo: mesmo pts, v, pct e jogos -> alfabetica
    const rows = buildRanking(computeStats(players, [match('m1', [['a', 'v', 0], ['b', 'v', 0]])]))
    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Zeca'])
    expect(rows.map((r) => r.rank)).toEqual([1, 1])
  })
})

describe('artilharia', () => {
  it('ordena por gols, jogos e nome, e so mostra quem marcou', () => {
    const players = [P('a', 'Ana'), P('b', 'Bia'), P('c', 'Cadu')]
    const rows = buildScorers(
      computeStats(players, [match('m1', [['a', 'v', 2], ['b', 'v', 2], ['c', 'v', 0]])]),
    )
    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Bia'])
    expect(rows.map((r) => r.rank)).toEqual([1, 1])
    expect(rows[0].avg).toBe(2)
  })
})
