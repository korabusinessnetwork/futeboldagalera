import { JITTER_SORTEIO, MAX_ITER_BALANCEAMENTO, POSICOES_LINHA } from '../constants'
import type { Formation, LinePos, Lineup, LineupPlayer, LineupTeam, TeamKey } from '../types'
import type { Rng } from './rng'
import type { Candidate } from './starters'

const TEAMS: TeamKey[] = ['branco', 'preto']

function jitter(rating: number, rng: Rng): number {
  // j = rating + (rand-0.5)*5  =>  +-2.5 pontos
  return rating + (rng() - 0.5) * (JITTER_SORTEIO * 2)
}

function toLineup(c: Candidate, slot: LinePos, j: number): LineupPlayer {
  return {
    id: c.id,
    name: c.name,
    pos: c.pos,
    rating: c.rating,
    avulso: c.avulso,
    slot,
    oop: c.pos !== slot,
    j,
  }
}

/** Total do time = soma das notas de linha + reservas. O goleiro fica de fora,
 *  porque ele e definido pela ordem de confirmacao, nao pelo balanceamento. */
export function teamTotal(t: Pick<LineupTeam, 'line' | 'res'>): number {
  return [...t.line, ...t.res].reduce((acc, p) => acc + p.rating, 0)
}

function jTotal(line: LineupPlayer[], res: LineupPlayer[]): number {
  return [...line, ...res].reduce((acc, p) => acc + (p.j ?? p.rating), 0)
}

/**
 * Otimizacao local: troca pares do MESMO slot entre os times, sempre escolhendo
 * a troca que mais reduz |totalBranco - totalPreto|. Para quando nao ha melhora.
 * `baseB`/`baseP` sao pesos fixos que entram na conta mas nao podem ser trocados
 * (os reservas, no passe final).
 */
function optimizeSwaps(
  line: Record<TeamKey, LineupPlayer[]>,
  baseB: number,
  baseP: number,
): void {
  for (let iter = 0; iter < MAX_ITER_BALANCEAMENTO; iter++) {
    const tb = baseB + jTotal(line.branco, [])
    const tp = baseP + jTotal(line.preto, [])
    let best = Math.abs(tb - tp)
    let bestPair: [number, number] | null = null

    for (let i = 0; i < line.branco.length; i++) {
      for (let k = 0; k < line.preto.length; k++) {
        const a = line.branco[i]
        const b = line.preto[k]
        if (a.slot !== b.slot) continue
        const ja = a.j ?? a.rating
        const jb = b.j ?? b.rating
        const diff = Math.abs(tb - ja + jb - (tp - jb + ja))
        if (diff < best - 1e-9) {
          best = diff
          bestPair = [i, k]
        }
      }
    }
    if (!bestPair) break
    const [i, k] = bestPair
    const tmp = line.branco[i]
    line.branco[i] = line.preto[k]
    line.preto[k] = tmp
  }
}

/**
 * Secao 4.3 da spec.
 * @param starters titulares de linha ja escolhidos por pickStarters
 * @param reserves reservas na ordem de confirmacao
 */
export function balanceByFormation(
  starters: Candidate[],
  reserves: Candidate[],
  gks: Candidate[],
  formB: Formation,
  formP: Formation,
  rng: Rng,
): Lineup {
  const jOf = new Map<string, number>()
  for (const c of [...starters, ...reserves]) jOf.set(c.id, jitter(c.rating, rng))

  // 1-2. agrupa por posicao (rating desc); quem excede a vaga vai pro pool
  const need: Record<LinePos, number> = {
    ZAG: formB.ZAG + formP.ZAG,
    VOL: formB.VOL + formP.VOL,
    MC: formB.MC + formP.MC,
    ATA: formB.ATA + formP.ATA,
  }
  const assigned: Record<LinePos, Candidate[]> = { ZAG: [], VOL: [], MC: [], ATA: [] }
  const pool: Candidate[] = []

  for (const pos of POSICOES_LINHA) {
    const group = starters.filter((c) => c.pos === pos).sort((a, b) => b.rating - a.rating)
    assigned[pos] = group.slice(0, need[pos])
    pool.push(...group.slice(need[pos]))
  }
  // quem nao tem posicao definida entra direto no pool
  pool.push(...starters.filter((c) => c.pos == null || !POSICOES_LINHA.includes(c.pos as LinePos)))
  pool.sort((a, b) => b.rating - a.rating)

  // 3. buracos de posicao tapados com gente do pool (marcada como oop)
  for (const pos of POSICOES_LINHA) {
    while (assigned[pos].length < need[pos] && pool.length) {
      assigned[pos].push(pool.shift()!)
    }
  }

  // 4. distribuicao inicial em serpentina por posicao, respeitando a capacidade
  //    de cada formacao
  const line: Record<TeamKey, LineupPlayer[]> = { branco: [], preto: [] }
  const cap: Record<TeamKey, Formation> = { branco: { ...formB }, preto: { ...formP } }
  const left: Record<TeamKey, Record<LinePos, number>> = {
    branco: { ...cap.branco },
    preto: { ...cap.preto },
  }

  POSICOES_LINHA.forEach((pos, posIdx) => {
    const group = [...assigned[pos]].sort(
      (a, b) => (jOf.get(b.id) ?? b.rating) - (jOf.get(a.id) ?? a.rating),
    )
    let turn: 0 | 1 = (posIdx % 2) as 0 | 1 // serpentina: inverte o time inicial a cada posicao
    for (const c of group) {
      let team = TEAMS[turn]
      if (left[team][pos] <= 0) team = TEAMS[1 - turn]
      if (left[team][pos] <= 0) continue // sem vaga nos dois, nao deveria ocorrer
      left[team][pos] -= 1
      line[team].push(toLineup(c, pos, jOf.get(c.id) ?? c.rating))
      turn = (1 - turn) as 0 | 1
    }
  })

  // 5. otimizacao local: troca pares do MESMO slot entre os times, sempre
  //    escolhendo a troca que mais reduz |totalBranco - totalPreto|.
  //    Para quando nao ha melhora. Teto de 400 iteracoes.
  optimizeSwaps(line, 0, 0)

  // 6. reservas alternados; empate no numero de reservas desempata pelo time de
  //    menor total
  const res: Record<TeamKey, LineupPlayer[]> = { branco: [], preto: [] }
  for (const c of reserves) {
    let team: TeamKey
    if (res.branco.length !== res.preto.length) {
      team = res.branco.length < res.preto.length ? 'branco' : 'preto'
    } else {
      const tb = teamTotal({ line: line.branco, res: res.branco })
      const tp = teamTotal({ line: line.preto, res: res.preto })
      team = tb <= tp ? 'branco' : 'preto'
    }
    const slot = (c.pos && POSICOES_LINHA.includes(c.pos as LinePos) ? c.pos : 'MC') as LinePos
    res[team].push({
      id: c.id,
      name: c.name,
      pos: c.pos,
      rating: c.rating,
      avulso: c.avulso,
      slot,
      oop: false,
      j: jOf.get(c.id),
    })
  }

  // 8. passe final de ajuste (melhoria sobre o original).
  //    A nota que o grupo ve inclui o banco, mas o passo 5 so equilibra a
  //    linha. Quando o banco cai torto (um reserva forte de um lado, um fraco
  //    do outro), o total publicado sai desequilibrado mesmo com a linha
  //    perfeita. Este passe repete as trocas de mesmo slot com os reservas
  //    entrando na conta como peso fixo, entao a linha compensa o banco.
  optimizeSwaps(line, jTotal([], res.branco), jTotal([], res.preto))

  // 7. goleiros: 1o confirmado no Branco, 2o no Preto
  const gkOf = (i: number): LineupPlayer | null => {
    const g = gks[i]
    if (!g) return null
    return { id: g.id, name: g.name, pos: g.pos, rating: g.rating, avulso: g.avulso, slot: 'GOL' }
  }

  const teams: Record<TeamKey, LineupTeam> = {
    branco: {
      gk: gkOf(0),
      line: line.branco,
      res: res.branco,
      total: teamTotal({ line: line.branco, res: res.branco }),
    },
    preto: {
      gk: gkOf(1),
      line: line.preto,
      res: res.preto,
      total: teamTotal({ line: line.preto, res: res.preto }),
    },
  }

  return { teams, formB, formP }
}
