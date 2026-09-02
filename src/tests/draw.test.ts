import { describe, expect, it } from 'vitest'
import { parseFormation } from '../domain/constants'
import { draw, mulberry32, pickStarters, type Candidate } from '../domain/draw'
import type { LineupPlayer, Pos } from '../domain/types'

const c = (id: string, pos: Pos | null, rating = 50): Candidate => ({
  id, name: id, pos, rating, avulso: false,
})

const F = parseFormation('2-1-2-1') // ZAG2 VOL1 MC2 ATA1

describe('pickStarters (secao 4.2)', () => {
  it('corta pela ordem de confirmacao: quem chega antes joga', () => {
    const order = Array.from({ length: 16 }, (_, i) => c(`p${i}`, 'MC'))
    const { starters, reserves } = pickStarters(order, F, F)
    expect(starters).toHaveLength(12)
    expect(reserves.map((r) => r.id)).toEqual(['p12', 'p13', 'p14', 'p15'])
  })

  it('promove reserva da posicao em falta e rebaixa o titular mais atrasado do excedente', () => {
    // 12 vagas: 4 ZAG, 2 VOL, 4 MC, 2 ATA
    const order = [
      ...Array.from({ length: 4 }, (_, i) => c(`zag${i}`, 'ZAG')),
      ...Array.from({ length: 2 }, (_, i) => c(`vol${i}`, 'VOL')),
      ...Array.from({ length: 6 }, (_, i) => c(`mc${i}`, 'MC')), // 2 a mais que o necessario
      c('ata0', 'ATA'),
      c('ata1', 'ATA'), // ficariam de fora do corte
    ]
    const { starters, reserves } = pickStarters(order, F, F)
    const count = (p: Pos) => starters.filter((s) => s.pos === p).length
    expect(count('ATA')).toBe(2)
    expect(count('MC')).toBe(4)
    // o MC rebaixado e o ultimo da ordem entre os titulares, nao o pior jogador
    expect(reserves.map((r) => r.id)).toEqual(['mc4', 'mc5'])
  })

  it('reservas mantem a ordem de confirmacao', () => {
    const order = [c('a', 'MC'), c('b', 'ZAG'), ...Array.from({ length: 12 }, (_, i) => c(`x${i}`, 'MC'))]
    const { reserves } = pickStarters(order, F, F)
    const idx = (id: string) => order.findIndex((o) => o.id === id)
    for (let i = 1; i < reserves.length; i++) {
      expect(idx(reserves[i - 1].id)).toBeLessThan(idx(reserves[i].id))
    }
  })
})

function squad(): Candidate[] {
  return [
    c('gk1', 'GOL', 60), c('gk2', 'GOL', 40),
    c('z1', 'ZAG', 90), c('z2', 'ZAG', 70), c('z3', 'ZAG', 55), c('z4', 'ZAG', 45),
    c('v1', 'VOL', 80), c('v2', 'VOL', 30),
    c('m1', 'MC', 95), c('m2', 'MC', 85), c('m3', 'MC', 50), c('m4', 'MC', 20),
    c('a1', 'ATA', 100), c('a2', 'ATA', 35),
    c('r1', 'MC', 60), c('r2', 'ZAG', 25),
  ]
}

describe('draw (secao 4.3)', () => {
  const opts = { gkIds: ['gk1', 'gk2'], seed: 12345 }

  it('monta 6 na linha e 1 goleiro por time, respeitando a formacao', () => {
    const l = draw(squad(), F, F, opts)
    for (const key of ['branco', 'preto'] as const) {
      const t = l.teams[key]
      expect(t.line).toHaveLength(6)
      expect(t.gk).not.toBeNull()
      const by = (s: string) => t.line.filter((p: LineupPlayer) => p.slot === s).length
      expect([by('ZAG'), by('VOL'), by('MC'), by('ATA')]).toEqual([2, 1, 2, 1])
    }
  })

  it('poe o 1o goleiro confirmado no branco e o 2o no preto', () => {
    const l = draw(squad(), F, F, opts)
    expect(l.teams.branco.gk?.id).toBe('gk1')
    expect(l.teams.preto.gk?.id).toBe('gk2')
  })

  it('nao repete jogador entre os times', () => {
    const l = draw(squad(), F, F, opts)
    const ids = [
      ...l.teams.branco.line, ...l.teams.branco.res,
      ...l.teams.preto.line, ...l.teams.preto.res,
    ].map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('equilibra os times: diferenca de nota pequena', () => {
    const l = draw(squad(), F, F, opts)
    const diff = Math.abs(l.teams.branco.total - l.teams.preto.total)
    const soma = l.teams.branco.total + l.teams.preto.total
    expect(diff / soma).toBeLessThan(0.12)
  })

  it('a mesma semente reproduz o mesmo sorteio', () => {
    const a = draw(squad(), F, F, { ...opts, seed: 777 })
    const b = draw(squad(), F, F, { ...opts, seed: 777 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('sementes diferentes mudam o sorteio', () => {
    const a = draw(squad(), F, F, { ...opts, seed: 1 })
    const b = draw(squad(), F, F, { ...opts, seed: 999 })
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('grava a semente usada, para auditoria', () => {
    expect(draw(squad(), F, F, { ...opts, seed: 42 }).seed).toBe(42)
  })

  it('marca como fora de posicao quem tapa buraco', () => {
    // sem nenhum ATA: os buracos sao tapados pelo pool
    const sem = squad().filter((p) => p.pos !== 'ATA').concat([c('x1', 'MC', 50), c('x2', 'MC', 50)])
    const l = draw(sem, F, F, opts)
    const atas = [...l.teams.branco.line, ...l.teams.preto.line].filter((p) => p.slot === 'ATA')
    expect(atas).toHaveLength(2)
    expect(atas.every((p) => p.oop === true)).toBe(true)
  })

  it('aceita formacoes diferentes nos dois times', () => {
    const l = draw(squad(), parseFormation('3-0-2-1'), parseFormation('2-1-2-1'), opts)
    expect(l.teams.branco.line.filter((p) => p.slot === 'ZAG')).toHaveLength(3)
    expect(l.teams.branco.line.filter((p) => p.slot === 'VOL')).toHaveLength(0)
    expect(l.teams.preto.line.filter((p) => p.slot === 'VOL')).toHaveLength(1)
  })

  it('exige 2 goleiros titulares', () => {
    expect(() => draw(squad(), F, F, { gkIds: ['gk1'], seed: 1 })).toThrow(/goleiros/i)
  })

  it('recusa quando falta gente para a linha', () => {
    const poucos = squad().slice(0, 8)
    expect(() => draw(poucos, F, F, opts)).toThrow(/linha/i)
  })

  it('goleiro extra vai para o banco, nao para a linha', () => {
    const s = [...squad(), c('gk3', 'GOL', 50)]
    const l = draw(s, F, F, { gkIds: ['gk1', 'gk2', 'gk3'], seed: 3 })
    const res = [...l.teams.branco.res, ...l.teams.preto.res].map((p) => p.id)
    expect(res).toContain('gk3')
    expect([...l.teams.branco.line, ...l.teams.preto.line].map((p) => p.id)).not.toContain('gk3')
  })

  it('distribui reservas alternadamente entre os times', () => {
    const l = draw(squad(), F, F, opts)
    const nb = l.teams.branco.res.length
    const np = l.teams.preto.res.length
    expect(Math.abs(nb - np)).toBeLessThanOrEqual(1)
    expect(nb + np).toBe(2)
  })
})

describe('jitter', () => {
  it('fica dentro de +-2.5 pontos', () => {
    const rng = mulberry32(99)
    const l = draw(squad(), F, F, { gkIds: ['gk1', 'gk2'], rng })
    for (const p of [...l.teams.branco.line, ...l.teams.preto.line]) {
      expect(Math.abs((p.j ?? p.rating) - p.rating)).toBeLessThanOrEqual(2.5)
    }
  })
})

describe('passe final: o banco entra na conta do equilibrio', () => {
  /**
   * Caso real do grupo do seed: os dois ultimos a confirmar sao um reserva
   * muito forte (85) e um muito fraco (32.5). Como so ha 2 reservas, um vai
   * para cada time, e a linha precisa compensar. Sem o passe final o total
   * publicado saia com ~10% de diferenca mesmo com a linha equilibrada.
   */
  const desiguais: Candidate[] = [
    c('gk1', 'GOL', 85), c('gk2', 'GOL', 29),
    c('z1', 'ZAG', 57), c('z2', 'ZAG', 66), c('z3', 'ZAG', 66), c('z4', 'ZAG', 65),
    c('m1', 'MC', 72), c('m2', 'MC', 82.5), c('m3', 'MC', 65), c('m4', 'MC', 43.3),
    c('a1', 'ATA', 86), c('a2', 'ATA', 82.5), c('a3', 'ATA', 65),
    c('m5', 'MC', 53.3),
    c('res_forte', 'ZAG', 85),
    c('res_fraco', 'ZAG', 32.5),
  ]
  const opts = { gkIds: ['gk1', 'gk2'], seed: 4242 }

  it('mantem a diferenca de total baixa apesar do banco torto', () => {
    const l = draw(desiguais, F, F, opts)
    const diff = Math.abs(l.teams.branco.total - l.teams.preto.total)
    expect(diff).toBeLessThan(15)
  })

  it('nao quebra a formacao para conseguir o equilibrio', () => {
    const l = draw(desiguais, F, F, opts)
    for (const key of ['branco', 'preto'] as const) {
      const by = (s: string) => l.teams[key].line.filter((p) => p.slot === s).length
      expect([by('ZAG'), by('VOL'), by('MC'), by('ATA')]).toEqual([2, 1, 2, 1])
    }
  })

  it('nao promove reserva a titular: a ordem de confirmacao continua valendo', () => {
    const l = draw(desiguais, F, F, opts)
    const titulares = [...l.teams.branco.line, ...l.teams.preto.line].map((p) => p.id)
    expect(titulares).not.toContain('res_forte')
    expect(titulares).not.toContain('res_fraco')
  })
})
