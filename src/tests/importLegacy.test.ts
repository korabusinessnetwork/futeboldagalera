import { describe, expect, it } from 'vitest'
import {
  buildCarga,
  formationText,
  isAvulso,
  lineupMeta,
  orphanIds,
  posOf,
  q,
  remapLineup,
  slotOf,
  uuidFor,
  type LegacyDumpFile,
} from '../../scripts/import-legacy.mjs'

const dump = (): LegacyDumpFile => ({
  players: [
    { id: 'p1', name: 'Anderson', pos: 'MC' },
    { id: 'p2', name: "O'Brien", pos: 'ALA' },
    { id: 'p3', name: 'Saiu', pos: 'ZAG', deletedAt: '2026-01-01T00:00:00Z' },
  ],
  matches: [
    {
      id: 'm1',
      date: '2026-08-26',
      scoreBranco: 3,
      scorePreto: 2,
      entries: [
        { playerId: 'p1', team: 'branco', result: 'v', goals: 2 },
        { playerId: 'p2', team: 'preto', result: 'd', goals: 0, og: 1 },
      ],
      votes: { p1: 2 },
      lineup: {
        seed: 4242,
        formB: { ZAG: 2, VOL: 1, MC: 2, ATA: 1 },
        formP: { ZAG: 2, VOL: 1, MC: 1, ATA: 2 },
        teams: {
          branco: {
            gk: { id: 'gk1', name: 'Marcelo', pos: 'GOL', rating: 50 },
            line: [{ id: 'p1', name: 'Anderson', pos: 'MC', slot: 'MC', rating: 62.5 }],
            res: [{ id: 'p3', name: 'Saiu', pos: 'ZAG', slot: 'ZAG', rating: 40, oop: true }],
          },
          preto: {
            gk: null,
            line: [{ id: 'av-abc', name: 'Avulso', pos: 'ATA', slot: 'ATA', rating: 45, avulso: true }],
            res: [],
          },
        },
      },
    },
  ],
})

const OPTS = { slug: 'pmnh', name: 'PMNH & Amigos' }

describe('escape de SQL', () => {
  it('dobra a aspa simples do nome', () => {
    expect(q("O'Brien")).toBe("'O''Brien'")
    expect(q(null)).toBe('null')
  })

  it('nao deixa nome com aspa escapar para o SQL gerado', () => {
    const sql = buildCarga(dump(), OPTS)
    expect(sql).toContain("'O''Brien'")
    expect(sql).not.toContain("'O'Brien'")
  })
})

describe('posicao x slot', () => {
  it('preserva a posicao criada pelo grupo no cadastro', () => {
    expect(posOf('ALA')).toBe('ALA')
    expect(posOf('lib')).toBe('LIB')
    expect(posOf('')).toBeNull()
  })

  it('mas prende o slot da escalacao aos cinco papeis base', () => {
    expect(slotOf('MC')).toBe('MC')
    expect(slotOf('ALA')).toBeNull()
  })

  it('a carga grava ALA no jogador e nunca em match_entries.slot', () => {
    const sql = buildCarga(dump(), OPTS)
    expect(sql).toMatch(/insert into players[\s\S]*'ALA'/)
    const entries = sql.split('\n').filter((l) => l.includes('into match_entries'))
    expect(entries.some((l) => l.includes("'ALA'"))).toBe(false)
  })
})

describe('uuid deterministico', () => {
  it('deriva do slug, entao repete entre execucoes', () => {
    expect(uuidFor('pmnh', 'player', 'p1')).toBe(uuidFor('pmnh', 'player', 'p1'))
  })

  it('muda com o slug, o tipo e o id', () => {
    expect(uuidFor('pmnh', 'player', 'p1')).not.toBe(uuidFor('outro', 'player', 'p1'))
    expect(uuidFor('pmnh', 'player', 'p1')).not.toBe(uuidFor('pmnh', 'match', 'p1'))
    expect(uuidFor('pmnh', 'player', 'p1')).not.toBe(uuidFor('pmnh', 'player', 'p2'))
  })

  it('tem forma de uuid v5', () => {
    expect(uuidFor('pmnh', 'player', 'p1')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('a carga e identica em duas geracoes com o mesmo tenant-id', () => {
    const o = { ...OPTS, tenantId: '11111111-1111-4111-8111-111111111111' }
    expect(buildCarga(dump(), o)).toBe(buildCarga(dump(), o))
  })
})

describe('escalacao', () => {
  it('grava o blob e a semente do sorteio', () => {
    const sql = buildCarga(dump(), OPTS)
    expect(sql).toContain('::jsonb')
    expect(sql).toContain('4242') // draw_seed
    expect(sql).toMatch(/insert into matches[\s\S]*lineup\)/)
  })

  it('reescreve os ids do blob para os uuids novos, menos o avulso', () => {
    const l = remapLineup(dump().matches![0].lineup!, 'pmnh')
    expect(l!.teams!.branco.line![0].id).toBe(uuidFor('pmnh', 'player', 'p1'))
    expect(l!.teams!.branco.res![0].id).toBe(uuidFor('pmnh', 'player', 'p3'))
    // avulso nao tem linha em players para apontar
    expect(l!.teams!.preto.line![0].id).toBe('av-abc')
  })

  it('aguenta partida sem escalacao', () => {
    expect(remapLineup(null, 'pmnh')).toBeNull()
    expect(lineupMeta(null).size).toBe(0)
    const semLineup: LegacyDumpFile = {
      players: [{ id: 'p1', name: 'A' }],
      matches: [{ id: 'm1', date: '2026-01-01' }],
    }
    const sql = buildCarga(semLineup, OPTS)
    expect(sql).toContain('insert into matches')
    expect(sql).toContain('commit;')
  })

  it('le slot, titularidade e nota congelada do blob', () => {
    const meta = lineupMeta(dump().matches![0].lineup!)
    expect(meta.get('p1')).toEqual({ slot: 'MC', starter: true, oop: false, rating: 62.5 })
    expect(meta.get('p3')).toEqual({ slot: 'ZAG', starter: false, oop: true, rating: 40 })
    expect(meta.get('gk1')).toEqual({ slot: 'GOL', starter: true, oop: false, rating: 50 })
  })
})

describe('tenant ja existente', () => {
  it('resolve o tenant_id por subselect, nunca pelo literal', () => {
    const sql = buildCarga(dump(), { ...OPTS, tenantId: '11111111-1111-4111-8111-111111111111' })
    // o id literal so aparece na criacao do tenant
    expect(sql.split('11111111-1111-4111-8111-111111111111').length - 1).toBe(1)
    expect(sql).toContain("from tenants where slug = 'pmnh'")
    expect(sql).toContain('on conflict (slug) do nothing')
  })
})

describe('orfaos', () => {
  it('acha id citado em partida e ausente do elenco', () => {
    const d = dump()
    d.matches![0].entries!.push({ playerId: 'fantasma', team: 'branco', result: 'v', goals: 0 })
    expect(orphanIds(d)).toEqual(['fantasma'])
  })

  it('nao conta avulso como orfao', () => {
    const d = dump()
    d.matches![0].entries!.push({ playerId: 'av-xyz', team: 'branco', result: 'v', goals: 0 })
    expect(orphanIds(d)).toEqual([])
    expect(isAvulso('av-xyz')).toBe(true)
    expect(isAvulso('p1')).toBe(false)
  })

  it('deixa o orfao de fora das entradas em vez de estourar a FK', () => {
    const d = dump()
    d.matches![0].entries!.push({ playerId: 'fantasma', team: 'branco', result: 'v', goals: 0 })
    expect(buildCarga(d, OPTS)).not.toContain('fantasma')
  })
})

describe('votos agregados', () => {
  it('viram uma linha por voto, com votante legacy-N', () => {
    const sql = buildCarga(dump(), OPTS)
    const votos = sql.split('\n').filter((l) => l.includes('into craque_votes'))
    expect(votos).toHaveLength(2) // p1 tinha 2 votos
    expect(votos[0]).toContain("'legacy-0'")
    expect(votos[1]).toContain("'legacy-1'")
  })
})

describe('formacao', () => {
  it('escreve na ordem ZAG-VOL-MC-ATA', () => {
    expect(formationText({ ZAG: 2, VOL: 1, MC: 2, ATA: 1 })).toBe('2-1-2-1')
    expect(formationText(null)).toBeNull()
  })
})

describe('status da partida', () => {
  it('sem placar e sem pending vira draft, com placar vira finished', () => {
    const semPlacar: LegacyDumpFile = {
      players: [],
      matches: [{ id: 'm1', date: '2026-01-01' }],
    }
    expect(buildCarga(semPlacar, OPTS)).toContain("'draft'")
    expect(buildCarga(dump(), OPTS)).toContain("'finished'")
  })
})
