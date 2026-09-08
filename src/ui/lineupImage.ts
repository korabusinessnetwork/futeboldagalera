import { readableOn, teamColor, teamDot, teamName } from '../domain/branding'
import { CANVAS_ESCALACAO, formationCode } from '../domain/constants'
import { buildDisp } from '../domain/names'
import { formatDate } from '../domain/match'
import type { Lineup, LineupPlayer, Pos, TeamKey, TenantBranding } from '../domain/types'

/** Ordem de desenho no campo, do ataque para a defesa. */
const ROWS: Pos[] = ['ATA', 'MC', 'VOL', 'ZAG']

function dispMap(lineup: Lineup): Map<string, string> {
  const all: Array<{ id: string; name: string }> = []
  for (const key of ['branco', 'preto'] as TeamKey[]) {
    const t = lineup.teams[key]
    if (t.gk) all.push(t.gk)
    all.push(...t.line, ...t.res)
  }
  return buildDisp(all)
}

/** Texto para o WhatsApp (secao 4.5 da spec). */
export function lineupText(lineup: Lineup, branding: TenantBranding, date: string): string {
  const disp = dispMap(lineup)
  const name = (p: LineupPlayer) => disp.get(p.id) ?? p.name
  const out: string[] = [`⚽ ${branding.name}, Escalação ${formatDate(date)}`, '']

  for (const key of ['branco', 'preto'] as TeamKey[]) {
    const t = lineup.teams[key]
    const form = formationCode(key === 'branco' ? lineup.formB : lineup.formP)
    out.push(`${teamDot(teamColor(branding, key))} ${teamName(branding, key).toUpperCase()} (${form})`)
    if (t.gk) out.push(`🧤 ${name(t.gk)}`)
    for (const row of [...ROWS].reverse()) {
      for (const p of t.line.filter((x) => x.slot === row)) {
        out.push(`${row} - ${name(p)}${p.oop ? ' *' : ''}`)
      }
    }
    if (t.res.length) out.push(`Reservas: ${t.res.map(name).join(', ')}`)
    out.push('')
  }
  return out.join('\n').trim()
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

interface DrawOpts {
  lineup: Lineup
  branding: TenantBranding
  date: string
  photos?: Record<string, string | null | undefined>
}

/**
 * Secao 4.5 da spec: canvas 2D puro, 900 x ~1900, sem biblioteca.
 * O card gerado no servidor (melhoria 8.9) substitui isso quando o Edge
 * Function entrar; ate la o cliente resolve.
 */
export async function renderLineupCanvas(opts: DrawOpts): Promise<HTMLCanvasElement> {
  const { lineup, branding, date, photos = {} } = opts
  const W = CANVAS_ESCALACAO.w
  const HEADER = 190
  const PANEL = 760
  const RES = 92
  const FOOTER = 66
  const H = HEADER + 2 * (PANEL + RES) + FOOTER

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const disp = dispMap(lineup)

  // fundo
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0d1410')
  g.addColorStop(1, '#060806')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // header
  ctx.fillStyle = branding.primaryColor
  ctx.font = '800 62px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ESCALAÇÕES', W / 2, 92)
  ctx.fillStyle = '#e8f3ea'
  ctx.font = '600 32px system-ui, sans-serif'
  ctx.fillText(branding.name, W / 2, 136)
  ctx.fillStyle = '#93b29b'
  ctx.font = '500 26px system-ui, sans-serif'
  ctx.fillText(formatDate(date), W / 2, 172)

  const imgCache = new Map<string, HTMLImageElement | null>()
  for (const [id, src] of Object.entries(photos)) {
    if (src) imgCache.set(id, await loadImage(src))
  }

  const drawPlayer = (p: LineupPlayer, cx: number, cy: number, shirt: string, ink: string) => {
    const r = 44
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fillStyle = shirt
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = p.oop ? '#ffd700' : branding.primaryColor
    ctx.stroke()
    const img = imgCache.get(p.id)
    if (img) {
      ctx.clip()
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
    } else {
      ctx.fillStyle = ink
      ctx.font = '800 34px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const nm = disp.get(p.id) ?? p.name
      ctx.fillText(nm.slice(0, 2).toUpperCase(), cx, cy + 2)
      ctx.textBaseline = 'alphabetic'
    }
    ctx.restore()

    ctx.fillStyle = '#e8f3ea'
    ctx.font = '700 24px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const label = disp.get(p.id) ?? p.name
    ctx.fillText(label.length > 13 ? `${label.slice(0, 12)}…` : label, cx, cy + r + 30)
  }

  let y = HEADER
  for (const key of ['branco', 'preto'] as TeamKey[]) {
    const t = lineup.teams[key]
    const form = formationCode(key === 'branco' ? lineup.formB : lineup.formP)
    const shirt = teamColor(branding, key)
    const ink = readableOn(shirt)

    // faixa do time
    ctx.fillStyle = shirt
    roundRect(ctx, 28, y + 6, W - 56, 54, 16)
    ctx.fill()
    ctx.fillStyle = ink
    ctx.font = '800 30px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(teamName(branding, key).toUpperCase(), 52, y + 44)
    ctx.textAlign = 'right'
    ctx.font = '600 26px system-ui, sans-serif'
    ctx.fillText(form, W - 52, y + 44)

    // campo
    const fieldTop = y + 76
    const fieldH = PANEL - 96
    ctx.fillStyle = '#102413'
    roundRect(ctx, 28, fieldTop, W - 56, fieldH, 20)
    ctx.fill()
    ctx.strokeStyle = 'rgba(232,243,234,0.16)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(W / 2, fieldTop + fieldH / 2, 78, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(28, fieldTop + fieldH / 2)
    ctx.lineTo(W - 28, fieldTop + fieldH / 2)
    ctx.stroke()

    // linhas por slot, do ataque para a defesa, goleiro no rodape do campo
    const rows = ROWS.map((slot) => t.line.filter((p) => p.slot === slot)).filter((r) => r.length)
    const bandH = fieldH / (rows.length + 1)
    rows.forEach((row, i) => {
      const cy = fieldTop + bandH * (i + 0.62)
      const step = (W - 120) / (row.length + 1)
      row.forEach((p, k) => drawPlayer(p, 60 + step * (k + 1), cy, shirt, ink))
    })
    if (t.gk) drawPlayer(t.gk, W / 2, fieldTop + fieldH - 74, shirt, ink)

    // reservas
    const resY = y + PANEL
    ctx.fillStyle = '#93b29b'
    ctx.font = '600 24px system-ui, sans-serif'
    ctx.textAlign = 'left'
    const names = t.res.map((p) => disp.get(p.id) ?? p.name).join(', ') || '—'
    ctx.fillText(`Reservas: ${names}`, 52, resY + 44)

    y = resY + RES
  }

  ctx.fillStyle = '#4d6653'
  ctx.font = '500 20px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('⚽ marcado em dourado = fora da posição de origem', W / 2, H - 26)

  return canvas
}

export async function shareCanvas(canvas: HTMLCanvasElement, filename: string, text: string) {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Não consegui gerar a imagem.')
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text })
    return
  }
  downloadBlob(blob, filename)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (blob) downloadBlob(blob, filename)
}
