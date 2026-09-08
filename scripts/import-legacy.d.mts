/** Tipos das funcoes puras de `import-legacy.mjs`, para o teste. */

export interface LegacyPlayer {
  id: string
  name: string
  pos?: string | null
  photo?: string | null
  photoUrl?: string | null
  app?: boolean
  isMonthly?: boolean
  deletedAt?: string | null
}

export interface LegacyEntry {
  playerId: string
  team: 'branco' | 'preto'
  result?: 'v' | 'e' | 'd'
  goals?: number
  og?: number
}

export interface LegacyLineupPlayer {
  id: string
  name: string
  pos?: string | null
  slot?: string | null
  rating?: number
  oop?: boolean | string
  avulso?: boolean
}

export interface LegacyLineup {
  teams?: Record<string, {
    gk?: LegacyLineupPlayer | null
    line?: LegacyLineupPlayer[]
    res?: LegacyLineupPlayer[]
  }>
  formB?: Record<string, number>
  formP?: Record<string, number>
  seed?: number
}

export interface LegacyMatch {
  id: string
  date: string
  entries?: LegacyEntry[]
  scoreBranco?: number | null
  scorePreto?: number | null
  escalaPub?: boolean
  pending?: boolean
  lineup?: LegacyLineup | null
  votes?: Record<string, number>
  craque?: string | null
  voteOpen?: boolean
  voteClosed?: boolean
  voteOpenedAt?: string | null
}

export interface LegacyDumpFile {
  players?: LegacyPlayer[]
  matches?: LegacyMatch[]
}

export interface CargaOptions {
  slug: string
  name: string
  tagline?: string | null
  tenantId?: string
}

export interface SlotMeta {
  slot: string | null
  starter: boolean
  oop: boolean
  rating?: number
}

export function q(v: unknown): string
export function num(v: unknown): string | number
export function bool(v: unknown): string
export function slotOf(p: unknown): string | null
export function posOf(p: unknown): string | null
export function formationText(f: Record<string, number> | null | undefined): string | null
export function uuidFor(slug: string, kind: string, legacyId: string): string
export function isAvulso(id: string): boolean
export function orphanIds(dump: LegacyDumpFile): string[]
export function remapLineup(lineup: LegacyLineup | null, slug: string): LegacyLineup | null
export function lineupMeta(lineup: LegacyLineup | null | undefined): Map<string, SlotMeta>
export function buildCarga(dump: LegacyDumpFile, options: CargaOptions): string
