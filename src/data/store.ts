import { create } from 'zustand'
import { buildRanking, buildScorers, totalGoals } from '../domain/ranking'
import { ratingTable } from '../domain/rating'
import { computeStats, defaultSeason, seasonsOf } from '../domain/stats'
import { accessMode } from '../domain/plan'
import type { PlayerStats, Role, TenantData } from '../domain/types'
import { authEnabled, currentUser, onAuthChange, signIn, signOut, type AuthUser } from './auth'
import { LocalRepository } from './localRepo'
import type { Repository } from './repo'
import { supabaseConfigured } from './supabaseClient'
import { SupabaseRepository } from './supabaseRepo'
import seed from '../../seed/demo.json'

const ADMIN_KEY = 'fdg_role'

/**
 * Escolhe o adapter (ADR-004). Com as variaveis do Supabase preenchidas o app
 * fala com o Postgres; sem elas roda 100% local, que e o modo de demonstracao e
 * tambem o modo offline do PWA.
 */
function createRepo(): Repository {
  return supabaseConfigured ? new SupabaseRepository() : new LocalRepository(seed as never)
}

interface State {
  repo: Repository
  data: TenantData | null
  loading: boolean
  error: string | null
  role: Role
  season: string | null
  /** null = sem sessao. So faz sentido no modo Supabase. */
  user: AuthUser | null
  /** false ate a sessao guardada ser resolvida: evita piscar a tela de login. */
  authReady: boolean
  initAuth: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  load: (slug: string) => Promise<void>
  refresh: () => Promise<void>
  setRole: (role: Role) => void
  setSeason: (season: string | null) => void
  /** Executa uma escrita e recarrega o snapshot. Toda escrita passa por aqui. */
  mutate: <T>(fn: (repo: Repository) => Promise<T>) => Promise<T>
}

/** Trava de assinatura unica do onAuthChange. Ver initAuth. */
let authIniciada = false

function initialRole(): Role {
  // No modo Supabase o papel so pode vir do banco. Um `fdg_role: admin` que
  // sobrou de quando o app rodava local nao pode valer como privilegio aqui.
  if (authEnabled) return 'viewer'
  if (typeof localStorage === 'undefined') return 'viewer'
  return (localStorage.getItem(ADMIN_KEY) as Role) ?? 'viewer'
}

export const useStore = create<State>((set, get) => ({
  repo: createRepo(),
  data: null,
  loading: true,
  error: null,
  role: initialRole(),
  season: null,
  user: null,
  authReady: !authEnabled,

  /**
   * Resolve a sessao guardada e passa a ouvir as mudancas. A sessao pode cair
   * sozinha (token expirado, logout em outra aba); quando cai, o grupo sai da
   * tela junto, senao sobra dado de um usuario que ja nao esta logado.
   */
  async initAuth() {
    if (!authEnabled || authIniciada) return
    // O StrictMode roda o efeito duas vezes em dev: sem esta trava, seriam dois
    // assinantes de onAuthChange e cada mudanca de sessao chegaria em dobro.
    authIniciada = true
    set({ user: await currentUser(), authReady: true })
    onAuthChange((user) => {
      if (user) set({ user })
      else set({ user: null, data: null, error: null, role: 'viewer' })
    })
  },

  async signIn(email, password) {
    const user = await signIn(email, password)
    set({ user })
  },

  async signOut() {
    await signOut()
    // O papel volta ao menor privilegio: o proximo login pode ser de outra
    // pessoa, e papel de admin nao pode sobreviver a troca de conta.
    set({ user: null, data: null, error: null, role: 'viewer' })
  },

  async load(slug) {
    set({ loading: true, error: null })
    try {
      const data = await get().repo.load(slug)
      // Com conta, o papel vem de `memberships`; sem conta, vale o toggle local.
      set({ data, loading: false, role: data.role ?? get().role })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  async refresh() {
    const { repo, data } = get()
    if (!data) return
    set({ data: await repo.load(data.tenant.slug) })
  },

  setRole(role) {
    // Toggle de demonstracao do modo local. No modo Supabase o papel e do banco.
    if (authEnabled) return
    if (typeof localStorage !== 'undefined') localStorage.setItem(ADMIN_KEY, role)
    set({ role })
  },

  setSeason(season) {
    set({ season })
  },

  async mutate(fn) {
    const { repo } = get()
    const out = await fn(repo)
    await get().refresh()
    return out
  },
}))

export const isAdmin = (role: Role) => role === 'owner' || role === 'admin'

export function useIsAdmin() {
  return isAdmin(useStore((s) => s.role))
}

/** Estatisticas ja filtradas pela temporada selecionada. */
export function useStats(): PlayerStats[] {
  const data = useStore((s) => s.data)
  const season = useStore((s) => s.season)
  if (!data) return []
  return computeStats(data.players, data.matches, season ?? undefined)
}

export function useRanking() {
  return buildRanking(useStats())
}

export function useScorers() {
  const stats = useStats()
  return { rows: buildScorers(stats), total: totalGoals(stats) }
}

/** Notas do elenco, com a media do grupo aplicada a quem nunca jogou. */
export function useRatings() {
  const data = useStore((s) => s.data)
  const stats = useStats()
  const table = ratingTable(stats)
  return { ...table, players: data?.players ?? [] }
}

export function useSeasons() {
  const data = useStore((s) => s.data)
  return data ? seasonsOf(data.matches) : []
}

export function useAccessMode() {
  const data = useStore((s) => s.data)
  if (!data) return 'full' as const
  return accessMode(data.subscription, data.players)
}

export { defaultSeason }
