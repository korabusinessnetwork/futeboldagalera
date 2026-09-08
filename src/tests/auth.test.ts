import { describe, expect, it } from 'vitest'
import { authErrorMessage, roleFromMembership, validateCredentials } from '../data/auth'

describe('roleFromMembership', () => {
  it('aceita os quatro papeis do schema', () => {
    expect(roleFromMembership('owner')).toBe('owner')
    expect(roleFromMembership('admin')).toBe('admin')
    expect(roleFromMembership('player')).toBe('player')
    expect(roleFromMembership('viewer')).toBe('viewer')
  })

  it('cai no menor privilegio diante de qualquer coisa estranha', () => {
    // linha ausente, papel novo que o front ainda nao conhece, lixo do banco
    expect(roleFromMembership(undefined)).toBe('viewer')
    expect(roleFromMembership(null)).toBe('viewer')
    expect(roleFromMembership('superadmin')).toBe('viewer')
    expect(roleFromMembership('Owner')).toBe('viewer')
    expect(roleFromMembership(42)).toBe('viewer')
  })
})

describe('authErrorMessage', () => {
  it('nao revela se o e-mail existe', () => {
    const msg = authErrorMessage(new Error('Invalid login credentials'))
    expect(msg).toBe('E-mail ou senha incorretos.')
    // a mesma resposta para conta inexistente e para senha errada
    expect(authErrorMessage(new Error('invalid credentials'))).toBe(msg)
  })

  it('traduz os casos que o usuario consegue resolver', () => {
    expect(authErrorMessage(new Error('Email not confirmed'))).toMatch(/confirmada/)
    expect(authErrorMessage(new Error('Request rate limit reached'))).toMatch(/Muitas tentativas/)
    expect(authErrorMessage(new Error('Failed to fetch'))).toMatch(/Sem conexao/)
  })

  it('nunca devolve o texto cru do Supabase', () => {
    const cru = 'AuthApiError: unexpected_failure at /token?grant_type=password'
    const msg = authErrorMessage(new Error(cru))
    expect(msg).not.toContain('grant_type')
    expect(msg).not.toContain('AuthApiError')
    expect(msg).toBe('Nao foi possivel entrar. Tente de novo em instantes.')
  })

  it('aguenta erro que nem Error e', () => {
    expect(authErrorMessage(null)).toBeTruthy()
    expect(authErrorMessage(undefined)).toBeTruthy()
    expect(authErrorMessage('string solta')).toBeTruthy()
  })
})

describe('validateCredentials', () => {
  it('passa com e-mail e senha preenchidos', () => {
    expect(validateCredentials('a@b.com', 'segredo')).toBeNull()
  })

  it('barra antes de gastar ida ao servidor', () => {
    expect(validateCredentials('', 'segredo')).toMatch(/e-mail/i)
    expect(validateCredentials('   ', 'segredo')).toMatch(/e-mail/i)
    expect(validateCredentials('semarroba', 'segredo')).toMatch(/invalido/i)
    expect(validateCredentials('a@b.com', '')).toMatch(/senha/i)
  })
})
