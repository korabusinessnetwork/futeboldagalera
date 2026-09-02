import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exportLegacy, importLegacy, type LegacyDump } from '../../data/legacy'
import { useIsAdmin, useStore } from '../../data/store'
import { formatDate, winnerOf } from '../../domain/match'
import type { Match, TeamKey } from '../../domain/types'
import { downloadBlob } from '../lineupImage'
import { Banner, Empty, Modal, Section } from '../components/ui'

function EntryTags({ m, team, nameOf }: { m: Match; team: TeamKey; nameOf: (id: string) => string }) {
  const rows = m.entries.filter((e) => e.team === team)
  if (!rows.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {rows.map((e) => (
        <span key={e.playerId} className="chip">
          {nameOf(e.playerId)}
          {!m.pending && <span className="ml-1 font-bold text-ink">{e.result.toUpperCase()}</span>}
          {e.goals > 0 && <span className="ml-1">⚽{e.goals}</span>}
          {!!e.og && <span className="ml-1 text-danger">🔴{e.og} contra</span>}
        </span>
      ))}
    </div>
  )
}

export default function Historico() {
  const data = useStore((s) => s.data!)
  const mutate = useStore((s) => s.mutate)
  const isAdmin = useIsAdmin()
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<Match | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const matches = useMemo(
    () => [...data.matches].sort((a, b) => b.date.localeCompare(a.date)),
    [data.matches],
  )
  const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? '—'
  const teamName = (t: TeamKey) => data.tenant.branding.teamNames[t]

  const doExport = () => {
    const dump = exportLegacy(data)
    downloadBlob(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }), `futebol-da-galera-${data.tenant.slug}.json`)
  }

  const doImport = async (file: File | undefined) => {
    if (!file) return
    setMsg(null)
    try {
      const dump = JSON.parse(await file.text()) as LegacyDump
      const { players, matches: ms } = importLegacy(dump, data.tenant.id)
      await mutate((r) => r.replaceAll({ players, matches: ms }))
      setMsg(`Importado: ${players.length} jogadores, ${ms.length} partidas.`)
    } catch (e) {
      setMsg(`Falha ao importar: ${(e as Error).message}`)
    }
  }

  return (
    <Section title="Histórico">
      {msg && <Banner>{msg}</Banner>}

      {!matches.length ? (
        <Empty icon="📅">Nenhuma partida registrada.</Empty>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const w = winnerOf(m)
            return (
              <div key={m.id} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <span className="text-sm font-bold">{formatDate(m.date)}</span>
                  {m.pending ? (
                    <span className="chip text-gold">⏳ Aguardando resultado</span>
                  ) : (
                    <span className="tabular text-sm font-extrabold">
                      <span className={w === 'branco' ? 'text-accent' : ''}>{m.scoreBranco}</span>
                      <span className="mx-1 text-muted">×</span>
                      <span className={w === 'preto' ? 'text-accent' : ''}>{m.scorePreto}</span>
                    </span>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  {(['branco', 'preto'] as TeamKey[]).map((t) => (
                    <div key={t}>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                        {teamName(t)}
                        {w === t && <span className="ml-1 text-accent">· venceu</span>}
                        {w === 'empate' && <span className="ml-1 text-gold">· empate</span>}
                      </div>
                      <EntryTags m={m} team={t} nameOf={nameOf} />
                    </div>
                  ))}
                  {m.craque && (
                    <div className="text-xs text-gold">⭐ Craque: {nameOf(m.craque)}</div>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 border-t border-line px-3 py-2">
                    <button className="btn px-2 py-1 text-xs" onClick={() => nav(`../partida?id=${m.id}`)}>
                      Editar
                    </button>
                    {m.lineup && (
                      <button className="btn px-2 py-1 text-xs" onClick={() => nav(`../escalacao?id=${m.id}`)}>
                        Escalação
                      </button>
                    )}
                    <button className="btn btn-danger ml-auto px-2 py-1 text-xs" onClick={() => setConfirmDel(m)}>
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isAdmin && (
        <div className="card mt-4 space-y-2 p-3">
          <span className="label mb-0">Manutenção</span>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={doExport}>
              ⬇️ Exportar JSON
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              ⬆️ Importar JSON
            </button>
          </div>
          <button className="btn btn-danger w-full" onClick={() => setConfirmWipe(true)}>
            Apagar tudo
          </button>
          <p className="text-[11px] text-muted">
            O export sai no mesmo formato do app antigo, então serve de backup e de ponte para a migração.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              void doImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      )}

      <Modal
        open={!!confirmDel}
        title="Excluir partida"
        onClose={() => setConfirmDel(null)}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDel(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                void mutate((r) => r.deleteMatch(confirmDel!.id))
                setConfirmDel(null)
              }}
            >
              Excluir
            </button>
          </>
        }
      >
        <p className="text-muted">
          A partida de <b className="text-ink">{confirmDel && formatDate(confirmDel.date)}</b> sai do ranking e
          da artilharia. Exporte o JSON antes se quiser guardar.
        </p>
      </Modal>

      <Modal
        open={confirmWipe}
        title="Apagar tudo"
        onClose={() => setConfirmWipe(false)}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmWipe(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                void mutate((r) => r.replaceAll({ players: [], matches: [] }))
                setConfirmWipe(false)
              }}
            >
              Apagar tudo
            </button>
          </>
        }
      >
        <p className="text-muted">Isso zera jogadores e partidas deste grupo. Exporte o JSON antes.</p>
      </Modal>
    </Section>
  )
}
