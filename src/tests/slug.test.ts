import { describe, expect, it } from 'vitest'
import { SLUG_MAX, nomesUnicos, slugify, sugerirVariacao, validarSlug } from '../domain/slug'
import { parseRosterText } from '../domain/roster'
import { erroDeCriacao } from '../data/onboarding'

describe('slugify', () => {
  it('tira acento sem transformar em hifen', () => {
    expect(slugify('São João')).toBe('sao-joao')
    expect(slugify('Ação')).toBe('acao')
    expect(slugify('Grêmio Atlético')).toBe('gremio-atletico')
  })

  it('junta o resto em hifens e nao deixa sobra nas pontas', () => {
    expect(slugify('PMNH & Amigos')).toBe('pmnh-amigos')
    expect(slugify('  Futebol   da  Galera  ')).toBe('futebol-da-galera')
    expect(slugify('--Time--')).toBe('time')
    expect(slugify('Quarta 20h!!!')).toBe('quarta-20h')
  })

  it('corta no limite sem terminar em hifen', () => {
    const s = slugify('a'.repeat(50))
    expect(s.length).toBe(SLUG_MAX)
    expect(s.endsWith('-')).toBe(false)
    // o corte cai bem em cima de um hifen: nao pode sobrar
    const c = slugify('abcdefghij klmnopqrst uvwxyzabc defghij')
    expect(c.endsWith('-')).toBe(false)
  })

  it('devolve vazio quando nao sobra nada aproveitavel', () => {
    expect(slugify('⚽⚽⚽')).toBe('')
    expect(slugify('!!!')).toBe('')
    expect(slugify('')).toBe('')
  })
})

describe('validarSlug', () => {
  it('aceita o que o banco aceita', () => {
    expect(validarSlug('pmnh')).toBeNull()
    expect(validarSlug('pmnh-amigos')).toBeNull()
    expect(validarSlug('t2')).toBeNull()
    expect(validarSlug('9alegria')).toBeNull()
  })

  it('recusa o que a regra do banco recusaria', () => {
    expect(validarSlug('')).toMatch(/Escolha/)
    expect(validarSlug('a')).toMatch(/2 caracteres/)
    expect(validarSlug('a'.repeat(SLUG_MAX + 1))).toMatch(/no máximo/)
    expect(validarSlug('-comeca-com-hifen')).toMatch(/letras minúsculas/)
    expect(validarSlug('MAIUSCULA')).toMatch(/letras minúsculas/)
    expect(validarSlug('com espaco')).toMatch(/letras minúsculas/)
    expect(validarSlug('com_underline')).toMatch(/letras minúsculas/)
  })

  it('protege as rotas do proprio app', () => {
    expect(validarSlug('novo')).toMatch(/reservado/)
    expect(validarSlug('assinatura')).toMatch(/reservado/)
  })

  it('tudo que o slugify produz e valido, ou vazio', () => {
    const nomes = ['PMNH & Amigos', 'São João', 'Quarta 20h!!!', 'a'.repeat(50), 'Time-do-Zé']
    for (const nome of nomes) {
      const s = slugify(nome)
      if (s) expect(validarSlug(s)).toBeNull()
    }
  })
})

describe('sugerirVariacao', () => {
  it('acrescenta o sufixo mantendo o slug valido', () => {
    expect(sugerirVariacao('pmnh', '2')).toBe('pmnh-2')
    expect(validarSlug(sugerirVariacao('pmnh', '2'))).toBeNull()
  })

  it('nao estoura o limite mesmo com slug ja no maximo', () => {
    const cheio = 'a'.repeat(SLUG_MAX)
    const v = sugerirVariacao(cheio, 'x9')
    expect(v.length).toBeLessThanOrEqual(SLUG_MAX)
    expect(validarSlug(v)).toBeNull()
  })
})

describe('nomesUnicos', () => {
  it('tira repetido sem olhar caixa nem espaco', () => {
    const linhas = parseRosterText('Marcelo\n  marcelo \nMARCELO\nDoleski')
    expect(nomesUnicos(linhas).map((l) => l.name)).toEqual(['Marcelo', 'Doleski'])
  })

  it('preserva a ordem e a primeira grafia', () => {
    const linhas = parseRosterText('João\nAna\njoão')
    expect(nomesUnicos(linhas).map((l) => l.name)).toEqual(['João', 'Ana'])
  })

  it('junta com o parser de lista colada, sem segundo parser', () => {
    const linhas = nomesUnicos(parseRosterText('1 - Marcelo (GOL)\n2. Doleski (ZAG)\n• Marcelo'))
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toMatchObject({ name: 'Marcelo', posOverride: 'GOL' })
    expect(linhas[1]).toMatchObject({ name: 'Doleski', posOverride: 'ZAG' })
  })

  it('lista vazia continua vazia', () => {
    expect(nomesUnicos(parseRosterText(''))).toEqual([])
    expect(nomesUnicos(parseRosterText('\n\n   \n'))).toEqual([])
  })
})

describe('erroDeCriacao', () => {
  it('traduz os codigos que a create_tenant levanta', () => {
    expect(erroDeCriacao('slug_em_uso')).toMatch(/Já existe um grupo/)
    expect(erroDeCriacao('slug_invalido')).toMatch(/Endereço inválido/)
    expect(erroDeCriacao('nome_vazio')).toMatch(/Informe o nome/)
    expect(erroDeCriacao('auth_required')).toMatch(/Entre na sua conta/)
    expect(erroDeCriacao('limite_de_grupos')).toMatch(/máximo de grupos/)
  })

  it('nao vaza detalhe de banco quando o erro e outro', () => {
    const cru = 'PostgresError: relation "tenants" violates check constraint "x"'
    const msg = erroDeCriacao(cru)
    expect(msg).not.toContain('constraint')
    expect(msg).not.toContain('tenants')
    expect(msg).toMatch(/Não foi possível criar o grupo/)
  })
})
