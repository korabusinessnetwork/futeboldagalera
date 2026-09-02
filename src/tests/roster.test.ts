import { describe, expect, it } from 'vitest'
import { importRoster, matchPlayer, normName, parseRosterLine, parsePos } from '../domain/roster'
import { buildDisp, dispName } from '../domain/names'

const roster = [
  { id: '1', name: 'Anderson Schenkel', pos: 'MC' as const },
  { id: '2', name: 'Rafa Schimitz', pos: 'ZAG' as const },
  { id: '3', name: 'João fumaça', pos: 'MC' as const },
  { id: '4', name: 'Márcio Serena', pos: 'GOL' as const },
  { id: '5', name: 'Felipe B', pos: 'ATA' as const },
]

describe('normName', () => {
  it('tira acento, caixa, parenteses e pontuacao', () => {
    expect(normName('  Márcio  Serena (GOL)! ')).toBe('marcio serena')
    expect(normName('João fumaça')).toBe('joao fumaca')
  })
})

describe('parseRosterLine', () => {
  it('remove numeracao em varios formatos', () => {
    for (const raw of ['1 - Doleski', '2. Doleski', '3) Doleski', '• Doleski', '@Doleski', '4 Doleski']) {
      expect(parseRosterLine(raw)?.name).toBe('Doleski')
    }
  })

  it('le o sufixo de posicao e aceita sinonimos', () => {
    expect(parseRosterLine('Marcelo (goleiro)')?.posOverride).toBe('GOL')
    expect(parseRosterLine('Pavoni (fixo)')?.posOverride).toBe('ZAG')
    expect(parseRosterLine('Ze (cabeca)')?.posOverride).toBe('VOL')
    expect(parseRosterLine('Ana (ala)')?.posOverride).toBe('MC')
    expect(parseRosterLine('Bia (pivo)')?.posOverride).toBe('ATA')
  })

  it('mantem parenteses que nao sao posicao', () => {
    const p = parseRosterLine('Joao (irmao do Ze)')
    expect(p?.name).toBe('Joao (irmao do Ze)')
    expect(p?.posOverride).toBeNull()
  })

  it('ignora linha vazia', () => {
    expect(parseRosterLine('   ')).toBeNull()
  })

  it('parsePos aceita sinonimo e recusa lixo', () => {
    expect(parsePos('gk')).toBe('GOL')
    expect(parsePos('banana')).toBeNull()
  })
})

describe('matchPlayer', () => {
  it('casa nome completo mesmo com acento e caixa diferentes', () => {
    expect(matchPlayer('marcio serena', roster)?.id).toBe('4')
    expect(matchPlayer('JOÃO FUMAÇA', roster)?.id).toBe('3')
  })

  it('casa por primeiro nome', () => {
    expect(matchPlayer('Anderson', roster)?.id).toBe('1')
    expect(matchPlayer('Felipe', roster)?.id).toBe('5')
  })

  it('desempata pelo sobrenome quando o primeiro nome repete', () => {
    const dois = [
      { id: 'a', name: 'Rodrigo Marques' },
      { id: 'b', name: 'Rodrigo Cunhado Carreta' },
    ]
    expect(matchPlayer('Rodrigo Marques', dois)?.id).toBe('a')
    expect(matchPlayer('Rodrigo Cunhado', dois)?.id).toBe('b')
  })

  it('devolve null pra quem nao esta no elenco', () => {
    expect(matchPlayer('Fulano de Tal', roster)).toBeNull()
  })
})

describe('importRoster', () => {
  it('preserva a ordem da lista, que define quem senta no banco', () => {
    const { found } = importRoster('3) Felipe\n1 - Anderson\n2. Rafa', roster)
    expect(found.map((f) => f.player.id)).toEqual(['5', '1', '2'])
  })

  it('aplica o posOverride so daquele sorteio', () => {
    const { found } = importRoster('Anderson (ZAG)', roster)
    expect(found[0].posOverride).toBe('ZAG')
    expect(found[0].player.pos).toBe('MC') // o cadastro nao muda
  })

  it('junta os nao encontrados', () => {
    const { found, missing } = importRoster('Anderson\nFulano\nCiclano', roster)
    expect(found).toHaveLength(1)
    expect(missing).toEqual(['Fulano', 'Ciclano'])
  })

  it('nao repete o mesmo jogador em duas linhas', () => {
    const { found } = importRoster('Anderson\nAnderson Schenkel', roster)
    expect(found).toHaveLength(1)
  })
})

describe('nomes de exibicao (secao 4.4)', () => {
  it('usa so o primeiro nome quando nao ha conflito', () => {
    const d = buildDisp([{ id: '1', name: 'Anderson Schenkel' }, { id: '2', name: 'Rafa Schimitz' }])
    expect(d.get('1')).toBe('Anderson')
  })

  it('usa "Primeiro Segundo" quando o primeiro nome repete', () => {
    const d = buildDisp([
      { id: '1', name: 'Rodrigo Marques' },
      { id: '2', name: 'Rodrigo Cunhado Carreta' },
    ])
    expect(d.get('1')).toBe('Rodrigo Marques')
    expect(d.get('2')).toBe('Rodrigo Cunhado')
  })

  it('dispName encurta o sobrenome', () => {
    expect(dispName('Anderson Schenkel')).toBe('Anderson S.')
    expect(dispName('Doleski')).toBe('Doleski')
  })
})
