import type { Lineup, LineupPlayer, TeamKey } from './types'
import { teamTotal } from './draw/balance'

type Slot =
  | { kind: 'gk'; team: TeamKey }
  | { kind: 'line'; team: TeamKey; index: number }
  | { kind: 'res'; team: TeamKey; index: number }

function locate(l: Lineup, id: string): Slot | null {
  for (const team of ['branco', 'preto'] as TeamKey[]) {
    const t = l.teams[team]
    if (t.gk?.id === id) return { kind: 'gk', team }
    const li = t.line.findIndex((p) => p.id === id)
    if (li >= 0) return { kind: 'line', team, index: li }
    const ri = t.res.findIndex((p) => p.id === id)
    if (ri >= 0) return { kind: 'res', team, index: ri }
  }
  return null
}

function read(l: Lineup, s: Slot): LineupPlayer | null {
  const t = l.teams[s.team]
  if (s.kind === 'gk') return t.gk
  return (s.kind === 'line' ? t.line : t.res)[s.index] ?? null
}

function write(l: Lineup, s: Slot, p: LineupPlayer | null) {
  const t = l.teams[s.team]
  if (s.kind === 'gk') {
    t.gk = p
    return
  }
  const arr = s.kind === 'line' ? t.line : t.res
  if (p) arr[s.index] = p
}

/**
 * Ajuste manual pos-sorteio (secao 3.6): clicar em 2 jogadores troca eles de
 * lugar, inclusive banco <-> titular e goleiro. O slot fica com a vaga, nao com
 * a pessoa: quem entra herda o slot de quem sai.
 */
export function swapPlayers(lineup: Lineup, idA: string, idB: string): Lineup {
  if (idA === idB) return lineup
  const next: Lineup = JSON.parse(JSON.stringify(lineup))
  const a = locate(next, idA)
  const b = locate(next, idB)
  if (!a || !b) return lineup

  const pa = read(next, a)
  const pb = read(next, b)
  if (!pa || !pb) return lineup

  const slotA = a.kind === 'gk' ? 'GOL' : pa.slot
  const slotB = b.kind === 'gk' ? 'GOL' : pb.slot

  write(next, a, { ...pb, slot: slotA, oop: slotA != null && pb.pos !== slotA })
  write(next, b, { ...pa, slot: slotB, oop: slotB != null && pa.pos !== slotB })

  for (const team of ['branco', 'preto'] as TeamKey[]) {
    next.teams[team].total = teamTotal(next.teams[team])
  }
  return next
}
