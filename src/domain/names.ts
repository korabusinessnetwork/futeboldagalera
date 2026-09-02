/** Secao 4.4 da spec. */

function parts(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean)
}

/**
 * `buildDisp`: usa so o primeiro nome. Se dois jogadores compartilham o primeiro
 * nome, usa "Primeiro Segundo" para os dois.
 */
export function buildDisp(names: Array<{ id: string; name: string }>): Map<string, string> {
  const count = new Map<string, number>()
  for (const n of names) {
    const first = parts(n.name)[0]?.toLowerCase() ?? ''
    count.set(first, (count.get(first) ?? 0) + 1)
  }
  const out = new Map<string, string>()
  for (const n of names) {
    const p = parts(n.name)
    const first = p[0] ?? n.name
    const collides = (count.get(first.toLowerCase()) ?? 0) > 1
    out.set(n.id, collides && p[1] ? `${p[0]} ${p[1]}` : first)
  }
  return out
}

/** `dispName`: "Primeiro S." */
export function dispName(name: string): string {
  const p = parts(name)
  if (p.length < 2) return p[0] ?? name
  return `${p[0]} ${p[1][0].toUpperCase()}.`
}

export function initials(name: string): string {
  const p = parts(name)
  if (!p.length) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[1][0]).toUpperCase()
}
