import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useIsAdmin, useStore } from '../../data/store'
import { CRAQUE_CLOSE_MIN, CRAQUE_DURATION_MIN, CRAQUE_OPEN_MIN } from '../../domain/constants'
import {
  craqueState,
  eligibleForCraque,
  type Eligible,
  minuteLabel,
  msUntilClose,
  msUntilOpen,
  tallyVotes,
  voteStorageKey,
} from '../../domain/craque'
import { formatDate } from '../../domain/match'
import { Avatar, Banner, Confirm, Empty, Modal, Section } from '../components/ui'
import { deviceKey, renderCraqueCanvas } from '../craqueImage'
import { downloadCanvas, shareCanvas } from '../lineupImage'

function countdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${ss}`
}

export default function Craque() {
  const data = useStore((s) => s.data!)
  const mutate = useStore((s) => s.mutate)
  const isAdmin = useIsAdmin()
  const [params, setParams] = useSearchParams()
  const [now, setNow] = useState(() => new Date())
  const [msg, setMsg] = useState<string | null>(null)
  const [pickCraque, setPickCraque] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [craqueChoice, setCraqueChoice] = useState<Eligible | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const candidates = useMemo(
    () => data.matches.filter((m) => m.lineup).sort((a, b) => b.date.localeCompare(a.date)),
    [data.matches],
  )
  const match = candidates.find((m) => m.id === params.get('id')) ?? candidates[0] ?? null

  if (!match) {
    return (
      <Section title="Craque do jogo">
        <Empty icon="⭐">Ainda não há partida com escalação para votar.</Empty>
      </Section>
    )
  }

  const tz = data.tenant.branding.timezone
  const state = craqueState(match, now, tz)
  const msLeft = state === 'open' ? msUntilClose(match, now, tz) : null
  const eligible = eligibleForCraque(match)
  const { rows, total, leaders } = tallyVotes(match)
  const photo = (id: string) => data.players.find((p) => p.id === id)?.photoUrl ?? null
  const nameOf = (id: string) =>
    eligible.find((e) => e.id === id)?.name ?? data.players.find((p) => p.id === id)?.name ?? '—'

  const votedKey = voteStorageKey(match.id)
  const alreadyVoted = typeof localStorage !== 'undefined' && !!localStorage.getItem(votedKey)

  const vote = async (playerId: string) => {
    setMsg(null)
    try {
      await mutate((r) => r.vote(match.id, playerId, deviceKey()))
      localStorage.setItem(votedKey, playerId)
      setMsg('Voto registrado. O resultado sai no encerramento.')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  const shareCard = async (mode: 'share' | 'download') => {
    const winnerId = match.craque ?? leaders[0]
    if (!winnerId) return
    const canvas = await renderCraqueCanvas({
      branding: data.tenant.branding,
      date: match.date,
      name: nameOf(winnerId),
      votes: match.votes?.[winnerId] ?? 0,
      total,
      photoUrl: photo(winnerId),
    })
    const file = `craque-${match.date}.png`
    if (mode === 'share') await shareCanvas(canvas, file, `⭐ Craque do jogo ${formatDate(match.date)}: ${nameOf(winnerId)}`)
    else await downloadCanvas(canvas, file)
  }

  return (
    <Section
      title="Craque do jogo"
      right={
        candidates.length > 1 && (
          <select
            className="input w-auto py-1 text-xs"
            value={match.id}
            onChange={(e) => setParams({ id: e.target.value })}
          >
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {formatDate(m.date)}
              </option>
            ))}
          </select>
        )
      }
    >
      {msg && <Banner>{msg}</Banner>}

      {state === 'before' && (
        <div className="card mb-3 px-4 py-8 text-center">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted">A votação abre em</div>
          <div className="tabular text-4xl font-extrabold text-accent">
            {countdown(msUntilOpen(match, now, tz))}
          </div>
          <div className="mt-2 text-[11px] text-muted">
            Abre {minuteLabel(CRAQUE_OPEN_MIN)} e dura {CRAQUE_DURATION_MIN} min, até{' '}
            {minuteLabel(CRAQUE_CLOSE_MIN)} ({tz})
          </div>
        </div>
      )}

      {state === 'open' && (
        <>
          <div className="card mb-3 px-4 py-6 text-center">
            <div className="mb-1 text-xs uppercase tracking-wide text-muted">A votação encerra em</div>
            <div className="tabular text-4xl font-extrabold text-accent">
              {msLeft === null ? '--:--:--' : countdown(msLeft)}
            </div>
            <div className="mt-2 text-[11px] text-muted">
              {msLeft === null
                ? 'Aberta pelo admin. Encerra quando ele mandar.'
                : `${CRAQUE_DURATION_MIN} minutos a partir da abertura`}
            </div>
          </div>
          <Banner>
            🕘 A parcial fica escondida: o resultado só aparece no encerramento.
          </Banner>
          {alreadyVoted ? (
            <div className="card px-4 py-8 text-center text-sm text-muted">
              Voto computado em <b className="text-ink">{nameOf(localStorage.getItem(votedKey)!)}</b>. Agora é
              esperar a apuração.
            </div>
          ) : (
            <div className="card divide-y divide-line/60 overflow-hidden">
              {eligible.map((e) => (
                <button
                  key={e.id}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-card2"
                  onClick={() => void vote(e.id)}
                >
                  <Avatar name={e.name} photoUrl={photo(e.id)} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.name}</span>
                  <span className="chip">
                    {data.tenant.branding.teamNames[e.team]} · {e.starter ? e.slot : 'banco'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {(state === 'closed' || state === 'finalized') && (
        <>
          {state === 'finalized' && match.craque && (
            <div className="card mb-3 border-gold/40 bg-gradient-to-b from-gold/15 to-transparent px-4 py-6 text-center">
              <div className="mb-2 text-xs uppercase tracking-wide text-gold">⭐ Craque do jogo</div>
              <div className="mb-3 flex justify-center">
                <Avatar name={nameOf(match.craque)} photoUrl={photo(match.craque)} size={92} />
              </div>
              <div className="text-xl font-extrabold">{nameOf(match.craque)}</div>
              <div className="tabular text-sm text-muted">
                {match.votes?.[match.craque] ?? 0} de {total} votos
              </div>
            </div>
          )}

          {state === 'closed' && (
            <Banner tone="warn">
              Votação encerrada.{' '}
              {leaders.length > 1 ? 'Deu empate: o admin precisa cravar o craque.' : 'Apuração abaixo.'}
            </Banner>
          )}

          {!rows.length ? (
            <Empty icon="🗳">Nenhum voto registrado nesta partida.</Empty>
          ) : (
            <div className="card space-y-2 p-3">
              {rows.map((r) => (
                <div key={r.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate font-semibold">{nameOf(r.id)}</span>
                    <span className="tabular text-muted">
                      {r.votes} · {r.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-card2">
                    <div
                      className={`h-full rounded-full ${match.craque === r.id ? 'bg-gold' : 'bg-accent'}`}
                      style={{ width: `${Math.max(3, r.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {(match.craque || leaders.length === 1) && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn" onClick={() => void shareCard('share')}>
                📤 Compartilhar
              </button>
              <button className="btn" onClick={() => void shareCard('download')}>
                🖼 Baixar PNG
              </button>
            </div>
          )}
        </>
      )}

      {isAdmin && (
        <div className="card mt-4 space-y-2 p-3">
          <span className="label mb-0">Controles do admin</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn"
              disabled={state === 'open'}
              onClick={() => void mutate((r) => r.setVoteState(match.id, 'open'))}
            >
              {state === 'open' ? 'Votação aberta' : 'Abrir votação'}
            </button>
            <button className="btn" disabled={state !== 'open'} onClick={() => setConfirmClose(true)}>
              Encerrar agora
            </button>
            <button className="btn" onClick={() => setPickCraque(true)}>
              Definir craque
            </button>
            <button className="btn" onClick={() => setConfirmUndo(true)}>
              Desfazer
            </button>
          </div>
          <p className="text-[11px] text-muted">
            A votação dura {CRAQUE_DURATION_MIN} minutos e fecha sozinha. Sem abertura manual, ela abre{' '}
            {minuteLabel(CRAQUE_OPEN_MIN)} no dia da partida.
          </p>
        </div>
      )}

      <Confirm
        open={confirmClose}
        title="Encerrar a votação agora?"
        confirmLabel="Sim, encerrar"
        danger
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          void mutate((r) => r.setVoteState(match.id, 'closed'))
          setMsg('Votação encerrada. A apuração já está visível.')
        }}
      >
        <p>
          Faltam <b className="text-ink">{msLeft === null ? '—' : countdown(msLeft)}</b> para o
          encerramento automático. Encerrando agora, ninguém mais vota e a apuração fica visível para
          todo mundo.
        </p>
      </Confirm>

      <Confirm
        open={confirmUndo}
        title="Desfazer a votação?"
        confirmLabel="Sim, desfazer"
        danger
        onClose={() => setConfirmUndo(false)}
        onConfirm={() => {
          void mutate(async (r) => {
            await r.setCraque(match.id, null)
            return r.setVoteState(match.id, 'auto')
          })
          setMsg('Votação voltou para o modo automático.')
        }}
      >
        <p>
          Isso apaga o craque definido e devolve a votação de{' '}
          <b className="text-ink">{formatDate(match.date)}</b> para o modo automático. Os votos já
          registrados continuam salvos.
        </p>
      </Confirm>

      <Modal
        open={pickCraque}
        title="Definir craque na mão"
        onClose={() => {
          setPickCraque(false)
          setCraqueChoice(null)
        }}
      >
        <p className="mb-2 text-xs text-muted">Útil para desempatar. Fica registrado como decisão do admin.</p>
        <div className="max-h-80 divide-y divide-line/60 overflow-auto">
          {eligible.map((e) => (
            <button
              key={e.id}
              className="flex w-full items-center gap-2 py-2 text-left"
              onClick={() => setCraqueChoice(e)}
            >
              <Avatar name={e.name} photoUrl={photo(e.id)} size={26} />
              <span className="flex-1 truncate text-sm">{e.name}</span>
              <span className="tabular text-xs text-muted">{match.votes?.[e.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Fica por cima da lista: cancelar volta para a escolha, sem perder o lugar. */}
      <Confirm
        open={!!craqueChoice}
        title="Confirmar o craque?"
        confirmLabel="Sim, é esse"
        onClose={() => setCraqueChoice(null)}
        onConfirm={() => {
          const chosen = craqueChoice!
          void mutate((r) => r.setCraque(match.id, chosen.id))
          setPickCraque(false)
          setMsg(`${chosen.name} definido como craque do jogo.`)
        }}
      >
        {craqueChoice && (
          <div className="flex items-center gap-3">
            <Avatar name={craqueChoice.name} photoUrl={photo(craqueChoice.id)} size={48} />
            <div className="min-w-0">
              <div className="truncate font-bold">{craqueChoice.name}</div>
              <div className="text-xs text-muted">
                {data.tenant.branding.teamNames[craqueChoice.team]} ·{' '}
                {match.votes?.[craqueChoice.id] ?? 0} de {total} votos
              </div>
            </div>
          </div>
        )}
        <p className="mt-3">
          Ele vira o craque de <b className="text-ink">{formatDate(match.date)}</b> e a votação é
          encerrada. Dá para trocar depois em "Definir craque" ou limpar em "Desfazer".
        </p>
      </Confirm>
    </Section>
  )
}
