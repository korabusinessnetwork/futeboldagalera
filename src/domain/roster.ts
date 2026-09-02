import type { Pos } from './types'

/** Secao 3.5.3 da spec: colar a lista do WhatsApp e casar com o elenco. */

/** Remove acentos, minusculas, remove parenteses e tudo que nao e alfanumerico. */
export function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const POS_SINONIMOS: Record<string, Pos> = {
  gol: 'GOL', goleiro: 'GOL', gk: 'GOL',
  zag: 'ZAG', zagueiro: 'ZAG', def: 'ZAG', fixo: 'ZAG',
  vol: 'VOL', volante: 'VOL', cabeca: 'VOL', primeiro: 'VOL',
  mc: 'MC', mei: 'MC', meio: 'MC', meia: 'MC', ala: 'MC',
  ata: 'ATA', atac: 'ATA', fw: 'ATA', pivo: 'ATA',
}

export function parsePos(token: string | null | undefined): Pos | null {
  if (!token) return null
  const t = normName(token)
  return POS_SINONIMOS[t] ?? null
}

export interface ParsedLine {
  raw: string
  name: string
  /** Sobrescreve a posicao SO para este sorteio. */
  posOverride: Pos | null
}

/** Limpa numeracao (`1 -`, `2.`, `3)`, `•`, `@`) e extrai o sufixo de posicao. */
export function parseRosterLine(raw: string): ParsedLine | null {
  let s = raw.trim()
  if (!s) return null
  s = s.replace(/^[\s•–—*+@#-]*\d+\s*[-.)\]:]*\s*/, '')
  s = s.replace(/^[\s•–—*+@#-]+/, '')
  s = s.trim()
  if (!s) return null

  let posOverride: Pos | null = null
  const m = s.match(/\(([^)]*)\)\s*$/)
  if (m) {
    const p = parsePos(m[1])
    if (p) {
      posOverride = p
      s = s.slice(0, m.index).trim()
    }
  }
  if (!s) return null
  return { raw, name: s, posOverride }
}

export function parseRosterText(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map(parseRosterLine)
    .filter((l): l is ParsedLine => l != null)
}

export interface MatchTarget {
  id: string
  name: string
}

/**
 * Match exato do nome completo; senao match por primeiro nome com `startsWith`
 * bidirecional e minimo de 3 chars, desempatado pelo score dos tokens seguintes.
 */
export function matchPlayer(query: string, roster: MatchTarget[]): MatchTarget | null {
  const q = normName(query)
  if (!q) return null

  const exact = roster.find((r) => normName(r.name) === q)
  if (exact) return exact

  const qt = q.split(' ')
  const qFirst = qt[0]
  if (!qFirst) return null

  let best: MatchTarget | null = null
  let bestScore = -1

  for (const r of roster) {
    const rt = normName(r.name).split(' ')
    const rFirst = rt[0] ?? ''
    if (qFirst.length < 3 || rFirst.length < 3) {
      if (qFirst !== rFirst) continue
    } else if (!qFirst.startsWith(rFirst) && !rFirst.startsWith(qFirst)) {
      continue
    }

    // desempate: quantos tokens seguintes tambem batem
    let score = 0
    for (let i = 1; i < Math.min(qt.length, rt.length); i++) {
      if (qt[i] === rt[i]) score += 2
      else if (qt[i].startsWith(rt[i]) || rt[i].startsWith(qt[i])) score += 1
    }
    if (qFirst === rFirst) score += 1
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return best
}

export interface RosterImport<T extends MatchTarget> {
  /** Na ordem da lista: a ordem define quem e titular e quem senta no banco. */
  found: Array<{ player: T; posOverride: Pos | null }>
  missing: string[]
}

export function importRoster<T extends MatchTarget>(text: string, roster: T[]): RosterImport<T> {
  const lines = parseRosterText(text)
  const found: RosterImport<T>['found'] = []
  const missing: string[] = []
  const used = new Set<string>()

  for (const line of lines) {
    const hit = matchPlayer(line.name, roster.filter((r) => !used.has(r.id))) as T | null
    if (hit) {
      used.add(hit.id)
      found.push({ player: hit, posOverride: line.posOverride })
    } else {
      missing.push(line.name)
    }
  }
  return { found, missing }
}
