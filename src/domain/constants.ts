import type { Formation, LinePos, Plan, Pos } from './types'

/** Secao 11 da spec: constantes a preservar. */

export const PTS = { v: 4, e: 2, d: 1 } as const

export const POSICOES: Pos[] = ['GOL', 'ZAG', 'VOL', 'MC', 'ATA']
export const POSICOES_LINHA: LinePos[] = ['ZAG', 'VOL', 'MC', 'ATA']

/** ZAG-VOL-MC-ATA, sempre 6 na linha + 1 goleiro. */
export const FORMACOES = [
  '2-1-2-1',
  '2-2-1-1',
  '3-1-1-1',
  '2-1-1-2',
  '2-0-3-1',
  '3-0-2-1',
  '2-0-2-2',
] as const

export type FormationCode = (typeof FORMACOES)[number]

export const FORMACAO_DEFAULT: FormationCode = '2-1-2-1'

/** Jogadores de linha por time (nao inclui goleiro). */
export const LINE_SIZE = 6

export const JITTER_SORTEIO = 2.5
export const MAX_ITER_BALANCEAMENTO = 400

/** Abertura automatica do Craque do Jogo, em minutos desde a meia-noite (fuso do grupo). */
export const CRAQUE_OPEN_MIN = 1290 // 21:30
/** A votacao dura 30 minutos a partir da abertura, automatica ou manual. */
export const CRAQUE_DURATION_MIN = 30
export const CRAQUE_DURATION_MS = CRAQUE_DURATION_MIN * 60_000
/** Fechamento da janela automatica: 22:00. */
export const CRAQUE_CLOSE_MIN = CRAQUE_OPEN_MIN + CRAQUE_DURATION_MIN

export const FOTO = { size: 320, quality: 0.72 } as const
export const CANVAS_ESCALACAO = { w: 900, h: 1900 } as const

export const RATING_FALLBACK = 50

export const PALETA_DEFAULT = {
  bg: '#0a0d0a',
  card: '#12180f',
  card2: '#18220f',
  line: '#26331b',
  text: '#e8f3ea',
  muted: '#93b29b',
  accent: '#22c55e',
  accent2: '#16a34a',
  gold: '#ffd700',
  silver: '#c0c8d0',
  bronze: '#cd7f32',
  danger: '#ef4444',
} as const

export const PLANOS: Plan[] = [
  { code: 'free', name: 'Entrada', priceCents: 0, maxPlayers: 12, isPublic: true },
  { code: 'galera', name: 'Galera', priceCents: 1990, maxPlayers: 12, isPublic: true },
  { code: 'time', name: 'Time', priceCents: 3990, maxPlayers: 24, isPublic: true },
  { code: 'liga', name: 'Liga', priceCents: 6990, maxPlayers: null, isPublic: true },
  // Vitalicio nunca aparece no checkout publico.
  { code: 'lifetime', name: 'Vitalicio', priceCents: 0, maxPlayers: null, isPublic: false },
]

/** Teste gratis de 3 meses, exige cartao vinculado no cadastro. */
export const TRIAL_DAYS = 90
/** Todo credito comprado vale um bloco de 30 dias. */
export const PERIOD_DAYS = 30
/**
 * Dias de graca antes de cair em somente leitura. So vale para quem esta na
 * cobranca recorrente, porque ai existe uma cobranca a ser reprocessada.
 * Quem comprou credito avulso ja sabia a data em que o tempo acaba.
 */
export const GRACE_DAYS = 7

export function parseFormation(code: string): Formation {
  const [zag, vol, mc, ata] = code.split('-').map((n) => Number(n))
  return { ZAG: zag, VOL: vol, MC: mc, ATA: ata }
}

export function formationCode(f: Formation): string {
  return `${f.ZAG}-${f.VOL}-${f.MC}-${f.ATA}`
}

export function formationSize(f: Formation): number {
  return f.ZAG + f.VOL + f.MC + f.ATA
}
