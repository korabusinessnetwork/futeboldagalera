import { POSICOES } from './constants'
import type { Pos, PosCode, TeamKey, TenantBranding } from './types'

/**
 * Os times sao "branco" e "preto" so por dentro: a chave nunca muda porque o
 * historico inteiro depende dela. O que o grupo ve — nome e cor da camisa —
 * mora no branding e pode ser trocado a qualquer momento.
 */
export const TEAM_COLORS_DEFAULT: Record<TeamKey, string> = {
  branco: '#f1f6f2',
  preto: '#14181a',
}

export function teamColor(branding: TenantBranding, key: TeamKey): string {
  return branding.teamColors?.[key] || TEAM_COLORS_DEFAULT[key]
}

export function teamName(branding: TenantBranding, key: TeamKey): string {
  return branding.teamNames[key]?.trim() || (key === 'branco' ? 'Branco' : 'Preto')
}

/** Preto ou branco, o que der mais contraste em cima da cor da camisa. */
export function readableOn(hex: string): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim())
  if (!m) return '#0a0d0a'
  const n = parseInt(m[1], 16)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => lin(c / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? '#0a0d0a' : '#f5faf6'
}

/** Bolinha do WhatsApp: segue a cor da camisa, nao a chave do time. */
export function teamDot(hex: string): string {
  return readableOn(hex) === '#0a0d0a' ? '⚪' : '⚫'
}

/**
 * Traduz uma posicao do grupo para uma das cinco base. Formacao, sorteio e
 * desenho do campo so entendem as cinco; o rotulo proprio fica na exibicao.
 * null quando o codigo nao existe mais no branding.
 */
export function basePos(branding: TenantBranding, code: PosCode | null | undefined): Pos | null {
  if (!code) return null
  if ((POSICOES as readonly string[]).includes(code)) return code as Pos
  return branding.positions?.find((p) => p.code === code)?.base ?? null
}
