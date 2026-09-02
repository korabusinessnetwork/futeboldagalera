import { formatDate } from '../domain/match'
import type { TenantBranding } from '../domain/types'

/** Card do Craque do Jogo, canvas 2D puro (secao 4.5 da spec). */
export async function renderCraqueCanvas(opts: {
  branding: TenantBranding
  date: string
  name: string
  votes: number
  total: number
  photoUrl?: string | null
}): Promise<HTMLCanvasElement> {
  const W = 900
  const H = 1100
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#101a12')
  g.addColorStop(1, '#060806')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffd700'
  ctx.font = '800 72px system-ui, sans-serif'
  ctx.fillText('⭐ CRAQUE DO JOGO', W / 2, 130)

  ctx.fillStyle = '#93b29b'
  ctx.font = '500 30px system-ui, sans-serif'
  ctx.fillText(`${opts.branding.name} · ${formatDate(opts.date)}`, W / 2, 180)

  const cx = W / 2
  const cy = 470
  const r = 190
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = '#18220f'
  ctx.fill()
  ctx.lineWidth = 12
  ctx.strokeStyle = '#ffd700'
  ctx.stroke()
  if (opts.photoUrl) {
    const img = await new Promise<HTMLImageElement | null>((res) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => res(null)
      i.src = opts.photoUrl!
    })
    if (img) {
      ctx.clip()
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
    }
  } else {
    ctx.fillStyle = '#93b29b'
    ctx.font = '800 130px system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(opts.name.slice(0, 2).toUpperCase(), cx, cy + 6)
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()

  ctx.fillStyle = '#e8f3ea'
  ctx.font = '800 60px system-ui, sans-serif'
  ctx.fillText(opts.name, W / 2, 760)

  ctx.fillStyle = opts.branding.primaryColor
  ctx.font = '700 40px system-ui, sans-serif'
  const pct = opts.total ? Math.round((opts.votes / opts.total) * 100) : 0
  ctx.fillText(`${opts.votes} ${opts.votes === 1 ? 'voto' : 'votos'} · ${pct}%`, W / 2, 830)

  ctx.fillStyle = '#4d6653'
  ctx.font = '500 26px system-ui, sans-serif'
  ctx.fillText(`${opts.total} ${opts.total === 1 ? 'voto apurado' : 'votos apurados'}`, W / 2, 890)

  return canvas
}

export function deviceKey(): string {
  const KEY = 'fdg_device'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
    localStorage.setItem(KEY, id)
  }
  return id
}
