import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { RepoError } from './repo'

/**
 * Client do Supabase. A URL e a chave saem SEMPRE do ambiente: nada de projeto,
 * ref ou chave escrita no codigo. Sem as duas variaveis o app roda no adapter
 * local, que e o modo de demonstracao e tambem o modo offline do PWA (ADR-004).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new RepoError(
      'Supabase nao configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
      'not_configured',
    )
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
