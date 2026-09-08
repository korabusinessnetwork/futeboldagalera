import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useIsAdmin, useStore } from '../../data/store'
import { swapPlayers } from '../../domain/lineupEdit'
import { formatDate } from '../../domain/match'
import type { Lineup, TenantBranding } from '../../domain/types'
import LineupView from '../components/LineupView'
import TeamIdentityEditor from '../components/TeamIdentityEditor'
import { downloadCanvas, lineupText, renderLineupCanvas, shareCanvas } from '../lineupImage'
import { Banner, Empty, Section } from '../components/ui'

export default function EscalacaoDia() {
  const data = useStore((s) => s.data!)
  const mutate = useStore((s) => s.mutate)
  const isAdmin = useIsAdmin()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const withLineup = useMemo(
    () => data.matches.filter((m) => m.lineup).sort((a, b) => b.date.localeCompare(a.date)),
    [data.matches],
  )
  const visible = isAdmin ? withLineup : withLineup.filter((m) => m.escalaPub !== false)

  const selectedId = params.get('id') ?? visible[0]?.id ?? null
  const match = visible.find((m) => m.id === selectedId) ?? visible[0] ?? null

  useEffect(() => {
    if (match && params.get('id') !== match.id) setParams({ id: match.id }, { replace: true })
  }, [match?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveBranding = (patch: Partial<TenantBranding>) =>
    void mutate((r) => r.updateBranding(patch))

  const photos = useMemo(
    () => Object.fromEntries(data.players.map((p) => [p.id, p.photoUrl])),
    [data.players],
  )

  if (!visible.length) {
    return (
      <Section title="Escalação do dia">
        {isAdmin && <TeamIdentityEditor branding={data.tenant.branding} onSave={saveBranding} />}
        <Empty icon="🟢">
          Nenhuma escalação liberada ainda. Quando o admin publicar, ela aparece aqui.
        </Empty>
      </Section>
    )
  }
  if (!match?.lineup) return null

  const oculta = match.escalaPub === false

  const doSwap = (a: string, b: string) => {
    const next: Lineup = swapPlayers(match.lineup!, a, b)
    void mutate((r) => r.updateMatch(match.id, { lineup: next }))
  }

  const image = async (mode: 'share' | 'download') => {
    setBusy(true)
    setMsg(null)
    try {
      const canvas = await renderLineupCanvas({
        lineup: match.lineup!,
        branding: data.tenant.branding,
        date: match.date,
        photos,
      })
      const file = `escalacao-${match.date}.png`
      if (mode === 'share') await shareCanvas(canvas, file, lineupText(match.lineup!, data.tenant.branding, match.date))
      else await downloadCanvas(canvas, file)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const copyText = async () => {
    await navigator.clipboard.writeText(lineupText(match.lineup!, data.tenant.branding, match.date))
    setMsg('Texto copiado para o WhatsApp.')
  }

  return (
    <Section
      title="Escalação do dia"
      right={
        visible.length > 1 && (
          <select
            className="input w-auto py-1 text-xs"
            value={match.id}
            onChange={(e) => setParams({ id: e.target.value })}
          >
            {visible.map((m) => (
              <option key={m.id} value={m.id}>
                {formatDate(m.date)}
              </option>
            ))}
          </select>
        )
      }
    >
      {msg && <Banner>{msg}</Banner>}

      {isAdmin && oculta && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2">
          <span className="text-xs font-semibold text-gold">🔒 Escalação oculta dos atletas</span>
          <button
            className="btn btn-primary px-2 py-1 text-xs"
            onClick={() => void mutate((r) => r.publishLineup(match.id, true))}
          >
            📢 Liberar
          </button>
        </div>
      )}
      {isAdmin && !oculta && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted">Visível para os atletas</span>
          <button
            className="btn px-2 py-1 text-xs"
            onClick={() => void mutate((r) => r.publishLineup(match.id, false))}
          >
            Ocultar
          </button>
        </div>
      )}

      {isAdmin && <TeamIdentityEditor branding={data.tenant.branding} onSave={saveBranding} />}

      {isAdmin && (
        <div className="card mb-3 flex items-end gap-2 p-3">
          <div className="flex-1">
            <span className="label">Data da partida</span>
            <input
              type="date"
              className="input"
              value={match.date}
              onChange={(e) => void mutate((r) => r.updateMatch(match.id, { date: e.target.value }))}
            />
          </div>
          <p className="pb-2 text-[11px] text-muted">Trocar a data não mexe no ranking.</p>
        </div>
      )}

      <LineupView
        lineup={match.lineup}
        branding={data.tenant.branding}
        photos={photos}
        onSwap={isAdmin ? doSwap : undefined}
      />

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button className="btn" disabled={busy} onClick={() => void image('share')}>
          📤 Compartilhar
        </button>
        <button className="btn" disabled={busy} onClick={() => void image('download')}>
          🖼 Baixar PNG
        </button>
        <button className="btn" onClick={() => void copyText()}>
          📋 Copiar texto
        </button>
      </div>

      {match.lineup.seed != null && (
        <p className="tabular mt-3 text-[11px] text-muted">Semente do sorteio: {match.lineup.seed}</p>
      )}
    </Section>
  )
}
