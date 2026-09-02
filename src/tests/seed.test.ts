import { describe, expect, it } from 'vitest'
import seed from '../../seed/demo.json'
import { exportLegacy, importLegacy, tenantDataFromLegacy } from '../data/legacy'
import { buildRanking, buildScorers, totalGoals } from '../domain/ranking'
import { ratingTable } from '../domain/rating'
import { computeStats, seasonsOf } from '../domain/stats'
import { eligibleForCraque } from '../domain/craque'
import type { LegacyDump } from '../data/legacy'

/**
 * Estes numeros saem do dump real do app antigo (seed/demo.json), que entra
 * aqui apenas como exemplo. Servem de trava: se um algoritmo mudar de
 * comportamento sem querer, o ranking do grupo real acusa.
 */
const dump = seed as unknown as LegacyDump

describe('importador do JSON legado (Fase 5)', () => {
  const { players, matches } = importLegacy(dump, 't')

  it('traz 36 jogadores e 5 partidas', () => {
    expect(players).toHaveLength(36)
    expect(matches).toHaveLength(5)
  })

  it('normaliza posicoes e mantem os ids originais', () => {
    expect(players.every((p) => p.pos == null || ['GOL', 'ZAG', 'VOL', 'MC', 'ATA'].includes(p.pos))).toBe(true)
    expect(players.find((p) => p.id === 'ms68vpzrkyl5x')?.name).toBe('Anderson Schenkel')
  })

  it('preserva as 90 participacoes e os gols contra', () => {
    expect(matches.reduce((a, m) => a + m.entries.length, 0)).toBe(90)
    expect(matches.reduce((a, m) => a + m.entries.reduce((x, e) => x + (e.og ?? 0), 0), 0)).toBe(4)
  })

  it('devolve o nome cadastrado dentro da escalacao, nao o apelido do snapshot', () => {
    // o dump antigo gravava "Felipe" e "Ze" na escalacao
    const m1 = matches.find((m) => m.id === 'ms6itfhof9y8f')!
    const felipe = m1.lineup!.teams.branco.line.find((p) => p.id === 'ms6ilkcgwbuzx')
    expect(felipe?.name).toBe('Felipe B')
  })

  it('converte `oop` string do dump antigo em booleano', () => {
    const todos = matches.flatMap((m) => [
      ...(m.lineup?.teams.branco.line ?? []),
      ...(m.lineup?.teams.preto.line ?? []),
    ])
    expect(todos.every((p) => typeof p.oop === 'boolean')).toBe(true)
    expect(todos.some((p) => p.oop === true)).toBe(true)
  })

  it('ordena as partidas por data', () => {
    const datas = matches.map((m) => m.date)
    expect(datas).toEqual([...datas].sort())
  })

  it('faz round-trip: exportar e reimportar nao perde jogador nem partida', () => {
    const data = tenantDataFromLegacy(dump)
    const again = importLegacy(exportLegacy(data), 't')
    expect(again.players).toHaveLength(36)
    expect(again.matches).toHaveLength(5)
  })
})

describe('ranking do grupo real', () => {
  const { players, matches } = importLegacy(dump, 't')
  const stats = computeStats(players, matches)
  const rows = buildRanking(stats)

  it('todo mundo jogou pelo menos uma vez', () => {
    expect(rows).toHaveLength(36)
  })

  it('lidera o Felipe B, com 17 pontos em 5 jogos', () => {
    expect(rows[0]).toMatchObject({ name: 'Felipe B', pts: 17, games: 5, v: 4, d: 1, rank: 1 })
    expect(rows[0].pct).toBeCloseTo(85, 6)
  })

  it('os quatro empatados em 14 pontos dividem a 2a posicao', () => {
    const segundos = rows.filter((r) => r.rank === 2)
    expect(segundos.map((r) => r.name).sort()).toEqual([
      'Anderson Schenkel',
      'Doleski',
      'Pavoni',
      'Rafa Schimitz',
    ])
    expect(segundos.every((r) => r.pts === 14 && r.v === 3)).toBe(true)
    // empate de 4 ocupa 2,3,4,5: o proximo e o 6o
    expect(rows.find((r) => r.rank > 2)?.rank).toBe(6)
  })
})

describe('artilharia do grupo real', () => {
  const { players, matches } = importLegacy(dump, 't')
  const stats = computeStats(players, matches)

  it('soma 64 gols no campeonato', () => {
    expect(totalGoals(stats)).toBe(64)
  })

  it('artilheiro e o Felipe B com 8', () => {
    const rows = buildScorers(stats)
    expect(rows[0]).toMatchObject({ name: 'Felipe B', goals: 8, rank: 1 })
    expect(rows.every((r) => r.goals > 0)).toBe(true)
  })
})

describe('notas do elenco', () => {
  const { players, matches } = importLegacy(dump, 't')
  const { byId } = ratingTable(computeStats(players, matches))

  it('todo jogador do elenco tem nota entre 0 e 100', () => {
    expect(byId.size).toBe(36)
    for (const r of byId.values()) {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(100)
    }
  })

  it('o lider do ranking tem nota maior que a lanterna', () => {
    const felipe = byId.get('ms6ilkcgwbuzx')!
    const media = [...byId.values()].reduce((a, b) => a + b, 0) / byId.size
    expect(felipe).toBeGreaterThan(media)
  })
})

describe('craque e temporada', () => {
  const { matches } = importLegacy(dump, 't')

  it('cada partida tem 18 elegiveis: 2 goleiros, 12 titulares e 4 reservas', () => {
    for (const m of matches) {
      expect(eligibleForCraque(m)).toHaveLength(18)
    }
  })

  it('a temporada sai do ano da partida', () => {
    expect(seasonsOf(matches)).toEqual(['2026'])
  })
})
