import { describe, expect, it } from 'vitest'
import { calcRating, groupAverageRating, ratingTable } from '../domain/rating'
import type { PlayerStats } from '../domain/types'

const s = (over: Partial<PlayerStats>): PlayerStats => ({
  id: 'x', name: 'X', pos: 'MC', games: 0, v: 0, e: 0, d: 0, pts: 0, pct: 0, goals: 0, ownGoals: 0,
  ...over,
})

describe('calcRating (secao 4.1)', () => {
  it('sem jogos, sem nota', () => {
    expect(calcRating(s({ games: 0 }))).toBeNull()
  })

  it('aplica 0.60 aproveitamento + 0.25 taxa de vitoria + 0.15 gols por jogo', () => {
    const r = calcRating(s({ games: 4, v: 2, goals: 2, pct: 75 }))
    // 0.6*75 + 0.25*50 + 0.15*50 = 45 + 12.5 + 7.5
    expect(r).toBeCloseTo(65, 6)
  })

  it('trava gols por jogo em 1', () => {
    const teto = calcRating(s({ games: 1, v: 1, goals: 1, pct: 100 }))
    const acima = calcRating(s({ games: 1, v: 1, goals: 9, pct: 100 }))
    expect(acima).toBe(teto)
    expect(acima).toBeCloseTo(100, 6)
  })
})

describe('media do grupo', () => {
  it('cai em 50 quando ninguem tem nota', () => {
    expect(groupAverageRating([null, null])).toBe(50)
  })

  it('quem nunca jogou herda a media do grupo', () => {
    const { byId, avg } = ratingTable([
      s({ id: 'a', games: 2, v: 2, goals: 0, pct: 100 }),
      s({ id: 'novo', games: 0 }),
    ])
    expect(byId.get('novo')).toBe(avg)
    expect(byId.get('a')).toBeCloseTo(0.6 * 100 + 0.25 * 100, 6)
  })
})
