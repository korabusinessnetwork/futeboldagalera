import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../../data/store'
import { applyScoreToEntries, deriveResult, todayISO } from '../../domain/match'
import type { MatchEntry, Result, TeamKey } from '../../domain/types'
import { Avatar, Banner, Modal, Section, Seg } from '../components/ui'

type Draft = Record<string, MatchEntry>

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

  const entries = Object.values(draft)
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
        {(scoreBranco != null || scorePreto != null) && (
          <p className="text-[11px] text-muted">
            Gols lançados por jogador: {golsBranco} × {golsPreto}. O placar oficial é o de cima; a diferença
            costuma ser gol contra.
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        {players.map((p) => {
          const e = draft[p.id]
          return (
            <div key={p.id} className="border-b border-line/60 px-3 py-2 last:border-0">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={!!e}
                  onChange={() => toggle(p.id)}
                />
                <Avatar name={p.name} photoUrl={p.photoUrl} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="chip">{p.pos ?? '—'}</span>
              </div>
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
                  <Seg<Result>
                    size="sm"
                    value={e.result}
                    onChange={(v) => patch(p.id, { result: v })}
                    options={[
                      { value: 'v', label: 'V', tone: 'ok' },
                      { value: 'e', label: 'E', tone: 'warn' },
                      { value: 'd', label: 'D', tone: 'bad' },
                    ]}
                  />
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
