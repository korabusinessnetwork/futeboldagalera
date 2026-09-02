import { POSICOES_LINHA, formationSize } from '../constants'
import type { Formation, LinePos, Lineup } from '../types'
import { balanceByFormation } from './balance'
import { mulberry32, newSeed, type Rng } from './rng'
import { pickStarters, type Candidate } from './starters'

export type { Candidate } from './starters'
export { pickStarters } from './starters'
export { balanceByFormation, teamTotal } from './balance'
export { mulberry32, newSeed } from './rng'

export interface DrawOptions {
  /** Ids marcados como goleiro, na ordem de confirmacao. Exatamente 2 titulares. */
  gkIds?: string[]
  /** Semente para reproduzir o sorteio. Sem semente, uma nova e gerada. */
  seed?: number
  rng?: Rng
}

export class DrawError extends Error {
  constructor(
    message: string,
    readonly code: 'few_players' | 'few_gks',
  ) {
    super(message)
    this.name = 'DrawError'
  }
}

const slotOrder = (s: LinePos | undefined) => POSICOES_LINHA.indexOf((s ?? 'MC') as LinePos)

/**
 * Melhoria 8.1 da spec: sorteio como funcao pura e testavel, sem DOM.
 * A ordem de `confirmed` E a ordem de confirmacao, e define quem e titular.
 */
export function draw(
  confirmed: Candidate[],
  formB: Formation,
  formP: Formation,
  options: DrawOptions = {},
): Lineup {
  const seed = options.seed ?? newSeed()
  const rng = options.rng ?? mulberry32(seed)

  const gkIds = options.gkIds ?? []
  const gkSet = new Set(gkIds)
  // goleiros na ordem em que foram marcados; do 3o em diante, vao pro banco
  const gks = gkIds.map((id) => confirmed.find((c) => c.id === id)).filter((c): c is Candidate => !!c)
  const gkStarters = gks.slice(0, 2)
  const gkExtras = gks.slice(2)

  const outfield = confirmed.filter((c) => !gkSet.has(c.id))
  const LINE = formationSize(formB) + formationSize(formP)

  if (gkStarters.length < 2) {
    throw new DrawError('Marque exatamente 2 goleiros titulares.', 'few_gks')
  }
  if (outfield.length < LINE) {
    throw new DrawError(
      `Faltam jogadores de linha: ${outfield.length} confirmados para ${LINE} vagas.`,
      'few_players',
    )
  }

  const { starters, reserves } = pickStarters(outfield, formB, formP)
  // goleiro extra vira reserva de linha, entrando no fim da fila
  const lineup = balanceByFormation(starters, [...reserves, ...gkExtras], gkStarters, formB, formP, rng)

  for (const key of ['branco', 'preto'] as const) {
    lineup.teams[key].line.sort((a, b) => slotOrder(a.slot as LinePos) - slotOrder(b.slot as LinePos))
  }
  lineup.seed = seed
  return lineup
}

/** Todos os jogadores de uma escalacao: titulares, goleiros e reservas dos 2 times. */
export function lineupPlayers(l: Lineup) {
  const out = []
  for (const key of ['branco', 'preto'] as const) {
    const t = l.teams[key]
    if (t.gk) out.push({ ...t.gk, team: key })
    for (const p of t.line) out.push({ ...p, team: key })
    for (const p of t.res) out.push({ ...p, team: key })
  }
  return out
}
