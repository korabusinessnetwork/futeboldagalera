import { create } from 'zustand'
import { buildRanking, buildScorers, totalGoals } from '../domain/ranking'
import { ratingTable } from '../domain/rating'
import { computeStats, defaultSeason, seasonsOf } from '../domain/stats'
import { accessMode } from '../domain/plan'
import type { PlayerStats, Role, TenantData } from '../domain/types'
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
  load: (slug: string) => Promise<void>
  refresh: () => Promise<void>
  setRole: (role: Role) => void
  setSeason: (season: string | null) => void
  /** Executa uma escrita e recarrega o snapshot. Toda escrita passa por aqui. */
  mutate: <T>(fn: (repo: Repository) => Promise<T>) => Promise<T>
}

function initialRole(): Role {
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

  async load(slug) {
    set({ loading: true, error: null })
    try {
      const data = await get().repo.load(slug)
      set({ data, loading: false })
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
