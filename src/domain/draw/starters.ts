import { POSICOES_LINHA, formationSize } from '../constants'
import type { Formation, LinePos, Pos } from '../types'

export interface Candidate {
  id: string
  name: string
  /** Posicao efetiva no sorteio (ja com posOverride da lista do WhatsApp aplicado). */
  pos: Pos | null
  rating: number
  avulso: boolean
}

function needsOf(formB: Formation, formP: Formation): Record<LinePos, number> {
  return {
    ZAG: formB.ZAG + formP.ZAG,
    VOL: formB.VOL + formP.VOL,
    MC: formB.MC + formP.MC,
    ATA: formB.ATA + formP.ATA,
  }
}

function countPos(list: Candidate[], pos: LinePos): number {
  return list.filter((c) => c.pos === pos).length
}

/**
 * Secao 4.2 da spec.
 *
 * Regra de ouro: quem confirmou primeiro joga, quem confirmou por ultimo senta
 * no banco. E social, nao tecnico, e e o que segura a paz do grupo. Por isso o
 * corte e pela ordem de confirmacao, e so depois vem o ajuste por posicao.
 *
 * @param order jogadores de linha na ORDEM DE CONFIRMACAO (sem goleiros)
 */
export function pickStarters(
  order: Candidate[],
  formB: Formation,
  formP: Formation,
): { starters: Candidate[]; reserves: Candidate[] } {
  const LINE = formationSize(formB) + formationSize(formP)
  const needs = needsOf(formB, formP)

  // 1. corte puro pela ordem de confirmacao
  const starters = order.slice(0, LINE)
  const reserves = order.slice(LINE)

  // 2. ajuste por posicao: promove reserva da posicao em falta, rebaixa o
  //    titular mais atrasado na ordem que esteja numa posicao com excedente.
  for (const pos of POSICOES_LINHA) {
    let guard = 0
    while (countPos(starters, pos) < needs[pos] && guard++ < LINE) {
      const promoteIdx = reserves.findIndex((c) => c.pos === pos)
      if (promoteIdx < 0) break

      const surplus = POSICOES_LINHA.filter((p) => p !== pos && countPos(starters, p) > needs[p])
      // titular mais atrasado na ordem (varre de tras pra frente) em posicao
      // excedente; jogador sem posicao definida e sempre candidato a descer.
      let demoteIdx = -1
      for (let i = starters.length - 1; i >= 0; i--) {
        const p = starters[i].pos
        if (p == null || (p !== 'GOL' && surplus.includes(p as LinePos))) {
          demoteIdx = i
          break
        }
      }
      if (demoteIdx < 0) break

      const promoted = reserves.splice(promoteIdx, 1)[0]
      const demoted = starters[demoteIdx]
      starters[demoteIdx] = promoted
      reserves.push(demoted)
    }
  }

  // 3. reservas voltam para a ordem de confirmacao original
  const rank = new Map(order.map((c, i) => [c.id, i]))
  reserves.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))

  return { starters, reserves }
}
