import { useState } from 'react'
import { TEAM_COLORS_DEFAULT, teamColor, teamName } from '../../domain/branding'
import type { TeamKey, TenantBranding } from '../../domain/types'

interface Props {
  branding: TenantBranding
  onSave: (patch: Partial<TenantBranding>) => void
}

const TIMES: TeamKey[] = ['branco', 'preto']
const MAX_NOME = 18

/**
 * "Branco" e "preto" sao so as chaves internas — o historico inteiro depende
 * delas e elas nunca mudam. Aqui o grupo batiza os dois times como quiser, com
 * a cor da camisa junto, e isso vale em toda a UI, no PNG e no texto do zap.
 */
export default function TeamIdentityEditor({ branding, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<TeamKey, string>>({
    branco: teamName(branding, 'branco'),
    preto: teamName(branding, 'preto'),
  })

  const salvarNome = (key: TeamKey, raw: string) => {
    const nome = raw.trim().slice(0, MAX_NOME) || teamName(branding, key)
    setDraft((d) => ({ ...d, [key]: nome }))
    if (nome === branding.teamNames[key]) return
    onSave({ teamNames: { ...branding.teamNames, [key]: nome } })
  }

  const salvarCor = (key: TeamKey, hex: string) => {
    const atuais: Record<TeamKey, string> = {
      branco: teamColor(branding, 'branco'),
      preto: teamColor(branding, 'preto'),
    }
    onSave({ teamColors: { ...atuais, [key]: hex } })
  }

  const restaurar = () => {
    setDraft({ branco: 'Branco', preto: 'Preto' })
    onSave({
      teamNames: { branco: 'Branco', preto: 'Preto' },
      teamColors: { ...TEAM_COLORS_DEFAULT },
    })
  }

  return (
    <div className="card mb-3 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">
            Nome dos times
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
            {TIMES.map((key, i) => (
              <span key={key} className="flex min-w-0 items-center gap-1">
                {i > 0 && <span className="text-muted">×</span>}
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-white/40"
                  style={{ background: teamColor(branding, key) }}
                />
                <span className="truncate">{teamName(branding, key)}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted">{open ? 'Fechar ▲' : 'Editar ▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {TIMES.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Cor do time ${key}`}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-line bg-card2 p-0.5"
                value={teamColor(branding, key)}
                onChange={(e) => salvarCor(key, e.target.value)}
              />
              <input
                className="input"
                maxLength={MAX_NOME}
                aria-label={`Nome do time ${key}`}
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                onBlur={(e) => salvarNome(key, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted">
              Vale para o app, o PNG e o texto do WhatsApp. O histórico não muda.
            </p>
            <button className="btn shrink-0 px-2 py-1 text-xs" onClick={restaurar}>
              Padrão
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
