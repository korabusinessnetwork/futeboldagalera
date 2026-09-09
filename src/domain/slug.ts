/**
 * Endereco do grupo: o `slug` que vira `/t/<slug>` e a chave estavel de tudo.
 *
 * Funcoes puras — o mesmo formato esta repetido na `create_tenant` do
 * `0005_onboarding.sql`, porque validacao no cliente e conveniencia e nao
 * garantia. Se os dois discordarem, quem manda e o banco.
 */

/** Comeca por letra ou numero, so minusculas, numeros e hifen, 2 a 31 chars. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/

export const SLUG_MAX = 31

/**
 * Enderecos que o app usa para outra coisa e que nao podem virar grupo, senao
 * `/t/novo` deixaria de abrir o assistente.
 */
const RESERVADOS = new Set(['novo', 'assinatura', 'admin', 'api', 'app', 'login', 'sair', 't'])

/**
 * Nome do grupo -> endereco. Tira acento, troca o que nao serve por hifen e
 * corta no limite. "PMNH & Amigos" vira "pmnh-amigos".
 */
export function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acento vira nada, nao vira hifen
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '') // o corte pode ter deixado um hifen solto no fim
}

/**
 * Mensagem do que esta errado, ou null quando esta valido. Devolver a mensagem
 * em vez de um booleano evita a tela ter que reconstruir o motivo.
 */
export function validarSlug(slug: string): string | null {
  if (!slug) return 'Escolha um endereço para o grupo.'
  if (slug.length < 2) return 'O endereço precisa de pelo menos 2 caracteres.'
  if (slug.length > SLUG_MAX) return `O endereço pode ter no máximo ${SLUG_MAX} caracteres.`
  if (!SLUG_RE.test(slug)) {
    return 'Use só letras minúsculas, números e hífen, começando por letra ou número.'
  }
  if (RESERVADOS.has(slug)) return 'Esse endereço é reservado pelo app. Escolha outro.'
  return null
}

/**
 * Sugestao quando o endereco ja existe: acrescenta um sufixo curto sem estourar
 * o limite. Nao consulta o banco — quem sabe o que existe e o banco.
 */
export function sugerirVariacao(slug: string, sufixo: string): string {
  const s = `-${sufixo}`
  const base = slug.slice(0, Math.max(1, SLUG_MAX - s.length)).replace(/-+$/, '')
  return `${base}${s}`
}

/**
 * Nome repetido na lista colada nao vira jogador duplicado. Compara sem caixa e
 * sem espaco nas pontas: "joao" e "  João " nao sao a mesma pessoa para o
 * `Set`, mas sao para quem colou a lista.
 *
 * O `players_tenant_name_uniq` do banco tambem barraria, mas com um erro por
 * linha repetida — melhor nao mandar.
 */
export function nomesUnicos<T extends { name: string }>(itens: T[]): T[] {
  const vistos = new Set<string>()
  const out: T[] = []
  for (const item of itens) {
    const chave = item.name.trim().toLowerCase()
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    out.push(item)
  }
  return out
}
