/**
 * Sessao do usuario. So existe no modo Supabase — o adapter local nao tem
 * conta, e por isso o toggle de demonstracao continua valendo la.
 *
 * Nada aqui guarda senha: o texto digitado vai direto para o `signInWithPassword`
 * e some com o componente. O que persiste e o token da sessao, que o proprio
 * supabase-js administra.
 */
import type { Role } from '../domain/types'
import { getSupabase, supabaseConfigured } from './supabaseClient'

export interface AuthUser {
  id: string
  email: string | null
}

/** true quando o app roda contra o Supabase e, portanto, exige login. */
export const authEnabled = supabaseConfigured

const PAPEIS: Role[] = ['owner', 'admin', 'player', 'viewer']

/**
 * Papel vindo de `memberships.role`. Valor desconhecido cai em `viewer`: na
 * duvida, o menor privilegio.
 */
export function roleFromMembership(value: unknown): Role {
  return PAPEIS.includes(value as Role) ? (value as Role) : 'viewer'
}

/**
 * Mensagem de erro de login em portugues.
 *
 * Credencial errada devolve sempre o mesmo texto, sem dizer se o e-mail existe:
 * a diferenca entre "usuario nao existe" e "senha errada" e um enumerador de
 * contas de graca para quem esta tentando.
 */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const m = raw.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (m.includes('email not confirmed')) return 'Esta conta ainda nao foi confirmada.'
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sem conexao com o servidor. Verifique a internet e tente de novo.'
  }
  return 'Nao foi possivel entrar. Tente de novo em instantes.'
}

/** Valida o formulario antes de gastar uma ida ao servidor. */
export function validateCredentials(email: string, password: string): string | null {
  if (!email.trim()) return 'Informe o e-mail.'
  if (!email.includes('@')) return 'E-mail invalido.'
  if (!password) return 'Informe a senha.'
  return null
}

function toUser(user: { id: string; email?: string } | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? null } : null
}

export async function currentUser(): Promise<AuthUser | null> {
  if (!authEnabled) return null
  const { data, error } = await getSupabase().auth.getSession()
  if (error) return null
  return toUser(data.session?.user)
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error(authErrorMessage(error))
  const user = toUser(data.user)
  if (!user) throw new Error(authErrorMessage(null))
  return user
}

export async function signOut(): Promise<void> {
  if (!authEnabled) return
  await getSupabase().auth.signOut()
}

/** Avisa quando a sessao cai sozinha (token expirado, logout em outra aba). */
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  if (!authEnabled) return () => {}
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    cb(toUser(session?.user))
  })
  return () => data.subscription.unsubscribe()
}
