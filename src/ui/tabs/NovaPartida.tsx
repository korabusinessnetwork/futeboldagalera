import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../../data/store'
import { applyScoreToEntries, deriveResult, formatDate, todayISO } from '../../domain/match'
import type { MatchEntry, Result, TeamKey } from '../../domain/types'
import { Avatar, Banner, Modal, Section, Seg } from '../components/ui'

type Draft = Record<string, MatchEntry>

const RESULT_UI: Record<Result, { label: string; cls: string }> = {
  v: { label: 'Vitória', cls: 'bg-accent text-black' },
  e: { label: 'Empate', cls: 'bg-gold text-black' },
  d: { label: 'Derrota', cls: 'bg-danger text-black' },
}

export default function NovaPartida() {
  const data = useStore((s) => s.data!)
  const mutate = useStore((s) => s.mutate)
  const [params, setParams] = useSearchParams()
  const editId = params.get('id')
  const editing = data.matches.find((m) => m.id === editId) ?? null

  const [date, setDate] = useState(() => todayISO(data.tenant.branding.timezone))
  const [sb, setSb] = useState<string>('')
  const [sp, setSp] = useState<string>('')
  const [draft, setDraft] = useState<Draft>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [onlyLast, setOnlyLast] = useState(false)

  useEffect(() => {
    if (!editing) return
    setDate(editing.date)
    setSb(editing.scoreBranco?.toString() ?? '')
    setSp(editing.scorePreto?.toString() ?? '')
    setDraft(Object.fromEntries(editing.entries.map((e) => [e.playerId, { ...e }])))
  }, [editId]) // eslint-disable-line react-hooks/exhaustive-deps

  const players = useMemo(
    () => data.players.filter((p) => !p.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [data.players],
  )

  /** Ultimo jogo com escalacao registrada; ao editar, o de antes desta partida. */
  const lastMatch = useMemo(
    () =>
      data.matches
        .filter((m) => m.id !== editId && m.entries.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
    [data.matches, editId],
  )
  const lastIds = useMemo(
    () => new Set((lastMatch?.entries ?? []).map((e) => e.playerId)),
    [lastMatch],
  )
  const visiblePlayers = onlyLast ? players.filter((p) => lastIds.has(p.id)) : players

  const scoreBranco = sb === '' ? null : Number(sb)
  const scorePreto = sp === '' ? null : Number(sp)

  // ao mexer no placar, o V/E/D de todo mundo se recalcula pelo time
  useEffect(() => {
    setDraft((d) => {
      const next: Draft = {}
      for (const [id, e] of Object.entries(d)) {
        next[id] = { ...e, result: deriveResult(e.team, scoreBranco, scorePreto) }
      }
      return next
    })
  }, [scoreBranco, scorePreto])

  const toggle = (id: string) =>
    setDraft((d) => {
      const next = { ...d }
      if (next[id]) delete next[id]
      else next[id] = { playerId: id, team: 'branco', result: deriveResult('branco', scoreBranco, scorePreto), goals: 0, og: 0 }
      return next
    })

  const patch = (id: string, p: Partial<MatchEntry>) =>
    setDraft((d) => {
      const cur = d[id]
      if (!cur) return d
      const merged = { ...cur, ...p }
      if (p.team) merged.result = deriveResult(p.team, scoreBranco, scorePreto)
      return { ...d, [id]: merged }
    })

  const scoreReady = scoreBranco != null && scorePreto != null
  const entries = Object.values(draft)
  const hiddenSelected = onlyLast ? entries.filter((e) => !lastIds.has(e.playerId)).length : 0
  const golsBranco = entries.filter((e) => e.team === 'branco').reduce((a, e) => a + e.goals, 0)
  const golsPreto = entries.filter((e) => e.team === 'preto').reduce((a, e) => a + e.goals, 0)

  const save = async (finalize: boolean) => {
    setMsg(null)
    try {
      const payload = {
        date,
        entries: applyScoreToEntries(entries, scoreBranco, scorePreto),
        scoreBranco,
        scorePreto,
        pending: finalize ? false : (editing?.pending ?? false),
      }
      if (editing) await mutate((r) => r.updateMatch(editing.id, payload))
      else await mutate((r) => r.createMatch(payload))
      setMsg(editing ? 'Partida atualizada.' : 'Partida registrada.')
      if (!editing) {
        setDraft({})
        setSb('')
        setSp('')
      }
      setParams({})
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  const teamName = (t: TeamKey) => data.tenant.branding.teamNames[t]

  return (
    <Section
      title={editing ? `Editar partida · ${editing.date}` : 'Nova partida'}
      right={
        editing && (
          <button className="btn px-2 py-1 text-xs" onClick={() => { setParams({}); setDraft({}); setSb(''); setSp('') }}>
            Cancelar edição
          </button>
        )
      }
    >
      {msg && <Banner>{msg}</Banner>}

      <div className="card mb-3 space-y-3 p-3">
        <div>
          <span className="label">Data</span>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <span className="label">{teamName('branco')}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="input text-center text-lg font-bold"
              value={sb}
              onChange={(e) => setSb(e.target.value)}
            />
          </div>
          <span className="pb-2 text-muted">×</span>
          <div className="flex-1">
            <span className="label">{teamName('preto')}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="input text-center text-lg font-bold"
              value={sp}
              onChange={(e) => setSp(e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted">
          O V/E/D de cada jogador sai deste placar, pelo time dele.
          {(scoreBranco != null || scorePreto != null) &&
            ` Gols lançados por jogador: ${golsBranco} × ${golsPreto}; o placar oficial é o de cima e a diferença costuma ser gol contra.`}
        </p>
      </div>

      {lastMatch && (
        <div className="mb-2">
          <button
            type="button"
            aria-pressed={onlyLast}
            onClick={() => setOnlyLast((v) => !v)}
            className={`btn w-full text-xs ${
              onlyLast
                ? 'border-transparent bg-gold text-black shadow-[0_0_16px_-2px_#ffd70066]'
                : 'border-gold/60 bg-gold/10 text-gold'
            }`}
          >
            <span aria-hidden>⚡</span>
            Mostrar apenas jogadores escalados no último jogo · {formatDate(lastMatch.date)}
          </button>
          {onlyLast && hiddenSelected > 0 && (
            <p className="mt-1 text-[11px] text-gold">
              {hiddenSelected} marcado{hiddenSelected > 1 ? 's' : ''} fora deste filtro
              {hiddenSelected > 1 ? ' continuam' : ' continua'} na partida.
            </p>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        {!visiblePlayers.length && (
          <p className="px-3 py-4 text-center text-sm text-muted">Ninguém do último jogo está no elenco.</p>
        )}
        {visiblePlayers.map((p) => {
          const e = draft[p.id]
          const result = e ? deriveResult(e.team, scoreBranco, scorePreto) : 'e'
          return (
            <div key={p.id} className="border-b border-line/60 px-3 py-2 last:border-0">
              <button
                type="button"
                aria-pressed={!!e}
                onClick={() => toggle(p.id)}
                className="-mx-1 flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left active:bg-card2"
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold leading-none ${
                    e ? 'border-transparent bg-accent text-black' : 'border-line bg-card2 text-transparent'
                  }`}
                >
                  ✓
                </span>
                <Avatar name={p.name} photoUrl={p.photoUrl} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="chip">{p.pos ?? '—'}</span>
              </button>
              {e && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                  <Seg<TeamKey>
                    size="sm"
                    value={e.team}
                    onChange={(v) => patch(p.id, { team: v })}
                    options={[
                      { value: 'branco', label: teamName('branco') },
                      { value: 'preto', label: teamName('preto') },
                    ]}
                  />
                  {scoreReady ? (
                    <span
                      className={`rounded-xl px-2 py-1 text-xs font-semibold ${RESULT_UI[result].cls}`}
                      title={`${RESULT_UI[result].label} — automático pelo placar`}
                    >
                      {result.toUpperCase()}
                    </span>
                  ) : (
                    <span className="chip" title="Preencha o placar para definir V/E/D">
                      V/E/D
                    </span>
                  )}
                  <label className="flex items-center gap-1 text-xs text-muted">
                    ⚽
                    <input
                      type="number"
                      min={0}
                      className="input w-14 px-2 py-1 text-center text-xs"
                      value={e.goals}
                      onChange={(ev) => patch(p.id, { goals: Math.max(0, Number(ev.target.value) || 0) })}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    🔴
                    <input
                      type="number"
                      min={0}
                      className="input w-14 px-2 py-1 text-center text-xs"
                      value={e.og ?? 0}
                      onChange={(ev) => patch(p.id, { og: Math.max(0, Number(ev.target.value) || 0) })}
                    />
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary flex-1" disabled={!entries.length} onClick={() => void save(false)}>
          {editing ? 'Salvar' : 'Registrar partida'}
        </button>
        {editing?.pending && (
          <button className="btn flex-1" onClick={() => setConfirmClose(true)}>
            Encerrar partida
          </button>
        )}
      </div>

      <Modal
        open={confirmClose}
        title="Encerrar partida"
        onClose={() => setConfirmClose(false)}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmClose(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setConfirmClose(false)
                void save(true)
              }}
            >
              Encerrar
            </button>
          </>
        }
      >
        <p className="text-muted">
          Ao encerrar, os resultados desta partida <b className="text-ink">entram no ranking</b> e na
          artilharia. Dá para editar depois, mas o ranking muda na hora.
        </p>
      </Modal>
    </Section>
  )
}
