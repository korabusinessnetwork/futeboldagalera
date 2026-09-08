import { useState } from 'react'
import { readableOn, teamColor, teamName } from '../../domain/branding'
import { POSICOES_LINHA, formationCode } from '../../domain/constants'
import { buildDisp, initials } from '../../domain/names'
import type { Lineup, LineupPlayer, Pos, TeamKey, TenantBranding } from '../../domain/types'

interface Props {
  lineup: Lineup
  branding: TenantBranding
  photos?: Record<string, string | null | undefined>
  /** Quando presente, habilita o ajuste manual: clicar em 2 jogadores troca. */
  onSwap?: (idA: string, idB: string) => void
}

/** Faixas do campo, do gol para o ataque. */
const FAIXAS: Pos[] = ['GOL', ...POSICOES_LINHA]

/** Marcacoes do gramado. So decoracao: nunca captura clique. */
function Marcacoes() {
  const cor = 'border-white/35'
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className={`absolute inset-[3%] rounded-sm border-2 ${cor}`} />
      <div className={`absolute inset-x-[3%] top-1/2 border-t-2 ${cor}`} />
      <div
        className={`absolute left-1/2 top-1/2 aspect-square w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${cor}`}
      />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45" />
      {/* grande area e pequena area, em cima (gol proprio) e embaixo (gol adversario) */}
      <div className={`absolute left-1/2 top-[3%] h-[14%] w-[54%] -translate-x-1/2 border-2 border-t-0 ${cor}`} />
      <div className={`absolute left-1/2 top-[3%] h-[6%] w-[28%] -translate-x-1/2 border-2 border-t-0 ${cor}`} />
      <div
        className={`absolute bottom-[3%] left-1/2 h-[14%] w-[54%] -translate-x-1/2 border-2 border-b-0 ${cor}`}
      />
      <div className={`absolute bottom-[3%] left-1/2 h-[6%] w-[28%] -translate-x-1/2 border-2 border-b-0 ${cor}`} />
    </div>
  )
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

  /** Camisa numerada do print: bolinha com a foto (ou as iniciais) + placa do nome. */
  const Jogador = ({
    p,
    shirt,
    ink,
    banco,
  }: {
    p: LineupPlayer
    shirt: string
    ink: string
    banco?: boolean
  }) => {
    const on = picked === p.id
    const foto = photos[p.id]
    const aro = on ? 'var(--accent)' : p.oop ? '#ffd700' : 'rgba(255,255,255,.92)'
    return (
      <button
        type="button"
        disabled={!onSwap}
        onClick={() => click(p.id)}
        title={`${p.name}${p.slot ? ` · ${p.slot}` : ''}${p.oop ? ' · fora de posição' : ''}`}
        className={`flex min-w-0 flex-col items-center ${
          banco ? 'w-[4.5rem]' : 'max-w-[6rem] flex-1'
        } ${onSwap ? 'transition active:scale-95' : ''}`}
      >
        <span
          className={`grid place-items-center overflow-hidden rounded-full border-[3px] font-extrabold shadow-[0_3px_8px_rgba(0,0,0,.45)] ${
            banco ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs sm:h-12 sm:w-12 sm:text-sm'
          }`}
          style={{ background: shirt, color: ink, borderColor: aro }}
        >
          {foto ? (
            <img src={foto} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(p.name)
          )}
        </span>
        <span
          className={`-mt-1.5 max-w-full truncate rounded-md px-1.5 py-px text-[9px] font-extrabold uppercase leading-tight tracking-wide shadow-[0_2px_5px_rgba(0,0,0,.4)] ${
            on ? 'bg-accent text-black' : 'bg-white text-[#0b2415]'
          }`}
        >
          {disp.get(p.id) ?? p.name}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {(['branco', 'preto'] as TeamKey[]).map((key) => {
        const t = lineup.teams[key]
        const form = formationCode(key === 'branco' ? lineup.formB : lineup.formP)
        const shirt = teamColor(branding, key)
        const ink = readableOn(shirt)
        const faixas = FAIXAS.map((slot) =>
          slot === 'GOL' ? (t.gk ? [t.gk] : []) : t.line.filter((p) => p.slot === slot),
        ).filter((row) => row.length)

        return (
          <div key={key} className="card overflow-hidden">
            <header className="flex items-center justify-center gap-2 px-3 pt-3">
              <span
                className="h-4 w-4 shrink-0 rounded-full border-2 border-white/60"
                style={{ background: shirt }}
              />
              <h3
                className="truncate text-xl font-extrabold uppercase leading-none tracking-wide"
                style={{ color: branding.primaryColor }}
              >
                {teamName(branding, key)}
              </h3>
            </header>
            <p className="tabular mt-1.5 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-muted">
              Escalação · {form} · nota {t.total.toFixed(1)}
            </p>

            <div className="p-3">
              <div className="pitch relative mx-auto aspect-[10/13] w-full max-w-[26rem] overflow-hidden rounded-2xl">
                <Marcacoes />
                <div className="absolute inset-0 flex flex-col py-[4%]">
                  {faixas.map((row, i) => (
                    <div key={i} className="flex flex-1 items-center justify-evenly gap-1 px-2">
                      {row.map((p) => (
                        <Jogador key={p.id} p={p} shirt={shirt} ink={ink} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {!!t.res.length && (
                <div className="mt-2 rounded-xl border border-line bg-card2 px-2 py-2">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                    Reservas
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {t.res.map((p) => (
                      <Jogador key={p.id} p={p} shirt={shirt} ink={ink} banco />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <p className="text-[11px] text-muted">
        <span className="text-gold">●</span> aro dourado = fora da posição de origem.
        {onSwap ? ' Toque em dois jogadores para trocá-los — vale banco ↔ titular e goleiro.' : ''}
      </p>
    </div>
  )
}
