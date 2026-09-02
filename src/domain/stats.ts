import { PTS } from './constants'
import type { Match, Player, PlayerStats } from './types'

/** Uma partida so entra no ranking quando deixa de ser `pending`. */
export function isCounted(m: Match, season?: string): boolean {
  if (m.pending) return false
  if (season && (m.season ?? defaultSeason(m.date)) !== season) return false
  return true
}

/** Temporada = ano da partida. O grupo joga o ano inteiro e reseta em janeiro. */
export function defaultSeason(date: string): string {
  return date.slice(0, 4)
}

export function seasonsOf(matches: Match[]): string[] {
  const set = new Set(matches.map((m) => m.season ?? defaultSeason(m.date)))
  return [...set].sort((a, b) => b.localeCompare(a))
}

export function emptyStats(p: Player): PlayerStats {
  return {
    id: p.id,
    name: p.name,
    pos: p.pos,
    games: 0,
    v: 0,
    e: 0,
    d: 0,
    pts: 0,
    pct: 0,
    goals: 0,
    ownGoals: 0,
  }
}

/**
 * Agrega estatisticas por jogador.
 * Pontuacao: vitoria 4, empate 2, derrota 1. Gol nao pontua.
 * Aproveitamento = pontos / (jogos * 4) * 100.
 */
export function computeStats(players: Player[], matches: Match[], season?: string): PlayerStats[] {
  const byId = new Map<string, PlayerStats>()
  for (const p of players) {
    if (p.deletedAt) continue
    if (p.app) continue // "Goleiro App" nao entra em ranking nem artilharia
    byId.set(p.id, emptyStats(p))
  }

  for (const m of matches) {
    if (!isCounted(m, season)) continue
    for (const e of m.entries) {
      const s = byId.get(e.playerId)
      if (!s) continue
      s.games += 1
      s[e.result] += 1
      s.pts += PTS[e.result]
      s.goals += e.goals || 0
      s.ownGoals += e.og || 0
    }
  }

  for (const s of byId.values()) {
    s.pct = s.games ? (s.pts / (s.games * PTS.v)) * 100 : 0
  }
  return [...byId.values()]
}
