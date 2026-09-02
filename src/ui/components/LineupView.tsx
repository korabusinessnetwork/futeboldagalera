import { useState } from 'react'
import { formationCode, POSICOES_LINHA } from '../../domain/constants'
import { buildDisp } from '../../domain/names'
import type { Lineup, LineupPlayer, TeamKey, TenantBranding } from '../../domain/types'
import { Avatar } from './ui'

interface Props {
  lineup: Lineup
  branding: TenantBranding
  photos?: Record<string, string | null | undefined>
  /** Quando presente, habilita o ajuste manual: clicar em 2 jogadores troca. */
  onSwap?: (idA: string, idB: string) => void
}

export default function LineupView({ lineup, branding, photos = {}, onSwap }: Props) {
  const [picked, setPicked] = useState<string | null>(null)

  const all: Array<{ id: string; name: string }> = []
  for (const key of ['branco', 'preto'] as TeamKey[]) {
    const t = lineup.teams[key]
    if (t.gk) all.push(t.gk)
    all.push(...t.line, ...t.res)
  }
  const disp = buildDisp(all)

  const click = (id: string) => {
    if (!onSwap) return
    if (!picked) return setPicked(id)
    if (picked === id) return setPicked(null)
    onSwap(picked, id)
    setPicked(null)
  }

  const Chip = ({ p, tag }: { p: LineupPlayer; tag: string }) => (
    <button
      type="button"
      disabled={!onSwap}
      onClick={() => click(p.id)}
      className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition ${
        picked === p.id ? 'border-accent bg-accent/20' : 'border-line bg-card2'
      } ${onSwap ? 'active:scale-[.98]' : ''}`}
    >
      <Avatar name={p.name} photoUrl={photos[p.id]} size={26} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold leading-tight">{disp.get(p.id) ?? p.name}</span>
        <span className="block text-[10px] leading-tight text-muted">
          {tag}
          {p.oop ? <span className="text-gold"> · fora de posição</span> : null}
          {p.avulso ? ' · avulso' : ''}
        </span>
      </span>
    </button>
  )

  return (
    <div className="space-y-3">
      {(['branco', 'preto'] as TeamKey[]).map((key) => {
        const t = lineup.teams[key]
        const form = formationCode(key === 'branco' ? lineup.formB : lineup.formP)
        return (
          <div key={key} className="card overflow-hidden">
            <div
              className={`flex items-center justify-between px-3 py-2 text-xs font-extrabold uppercase tracking-wide ${
                key === 'branco' ? 'bg-ink text-black' : 'bg-black/60 text-ink'
              }`}
            >
              <span>{branding.teamNames[key]}</span>
              <span className="tabular font-semibold opacity-70">
                {form} · nota {t.total.toFixed(1)}
              </span>
            </div>
            <div className="space-y-2 p-2">
              {t.gk && (
                <div className="grid grid-cols-2 gap-1.5">
                  <Chip p={t.gk} tag="🧤 GOL" />
                </div>
              )}
              {POSICOES_LINHA.map((slot) => {
                const row = t.line.filter((p) => p.slot === slot)
                if (!row.length) return null
                return (
                  <div key={slot} className="grid grid-cols-2 gap-1.5">
                    {row.map((p) => (
                      <Chip key={p.id} p={p} tag={slot} />
                    ))}
                  </div>
                )
              })}
              {!!t.res.length && (
                <>
                  <div className="pt-1 text-[10px] font-bold uppercase tracking-wide text-muted">Reservas</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {t.res.map((p) => (
                      <Chip key={p.id} p={p} tag="banco" />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}
      {onSwap && (
        <p className="text-[11px] text-muted">
          Toque em dois jogadores para trocá-los de lugar. Vale banco ↔ titular e goleiro.
        </p>
      )}
    </div>
  )
}
