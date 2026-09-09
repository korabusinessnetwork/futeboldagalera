/**
 * Criacao de grupo. Fica fora da porta `Repository` de proposito: aquela porta
 * opera *dentro* de um tenant, e aqui o tenant ainda nao existe.
 *
 * So faz sentido no modo Supabase — o adapter local nao tem conta nem
 * `memberships`, e o grupo dele e o seed de demonstracao.
 */
import { RepoError } from './repo'
import { getSupabase, supabaseConfigured } from './supabaseClient'

export const onboardingDisponivel = supabaseConfigured

export interface GrupoResumo {
  slug: string
  name: string
}

export interface NovoGrupo {
  nome: string
  slug: string
  tagline?: string | null
  cor?: string
}

/**
 * Mensagem para os erros que a `create_tenant` levanta. Os codigos sao os do
 * `0005_onboarding.sql`; qualquer outro vira texto generico, para nao vazar
 * detalhe de banco na tela.
 */
export function erroDeCriacao(mensagem: string): string {
  const m = (mensagem ?? '').toLowerCase()
  if (m.includes('slug_em_uso')) return 'Já existe um grupo nesse endereço. Escolha outro.'
  if (m.includes('slug_invalido')) return 'Endereço inválido. Use letras minúsculas, números e hífen.'
  if (m.includes('nome_vazio')) return 'Informe o nome do grupo.'
  if (m.includes('cor_invalida')) return 'Cor inválida.'
  if (m.includes('auth_required')) return 'Entre na sua conta para criar um grupo.'
  if (m.includes('limite_de_grupos')) {
    return 'Você já criou o máximo de grupos permitido por conta.'
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sem conexão com o servidor. Tente de novo.'
  }
  return 'Não foi possível criar o grupo. Tente de novo em instantes.'
}

/**
 * Cria grupo + assinatura + `membership` de dono, tudo na mesma transacao do
 * banco. Devolve o slug efetivamente gravado.
 */
export async function criarGrupo(input: NovoGrupo): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_tenant', {
    p_name: input.nome.trim(),
    p_slug: input.slug.trim().toLowerCase(),
    p_tagline: input.tagline?.trim() || null,
    p_color: input.cor || '#22c55e',
  })
  if (error) throw new RepoError(erroDeCriacao(error.message), 'create_tenant')
  if (typeof data !== 'string' || !data) {
    throw new RepoError(erroDeCriacao(''), 'create_tenant')
  }
  return data
}

/** Grupos que a conta enxerga. A RLS ja filtra: `is_member(id)`. */
export async function meusGrupos(): Promise<GrupoResumo[]> {
  const { data, error } = await getSupabase()
    .from('tenants')
    .select('slug, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw new RepoError('Falha ao carregar seus grupos.', 'db_error')
  return (data ?? []) as GrupoResumo[]
}
