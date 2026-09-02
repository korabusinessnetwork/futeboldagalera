import { useMemo, useRef, useState } from 'react'
import { useRatings, useStore } from '../../data/store'
import { POSICOES } from '../../domain/constants'
import { PlanLimitError, planOf, activePlayerCount, type PlanLimitPayload } from '../../domain/plan'
import { RepoError } from '../../data/repo'
import type { Player, Pos } from '../../domain/types'
import { compressPhoto } from '../photo'
import UpgradeModal from '../components/UpgradeModal'
import { Avatar, Banner, Empty, Modal, Section } from '../components/ui'

export default function Jogadores() {
  const data = useStore((s) => s.data!)
  const mutate = useStore((s) => s.mutate)
  const { byId: ratings } = useRatings()

  const [name, setName] = useState('')
  const [pos, setPos] = useState<Pos | ''>('')
  const [msg, setMsg] = useState<string | null>(null)
  const [limit, setLimit] = useState<PlanLimitPayload | null>(null)
  const [confirmDel, setConfirmDel] = useState<Player | null>(null)
  const [renaming, setRenaming] = useState<Player | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileFor = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const players = useMemo(
    () => data.players.filter((p) => !p.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [data.players],
  )
  const plan = planOf(data.subscription.planCode)
  const used = activePlayerCount(data.players)

  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      if (e instanceof PlanLimitError) setLimit(e.payload)
      else if (e instanceof RepoError) setMsg(e.message)
      else setMsg((e as Error).message)
    }
  }

  const add = () =>
    run(async () => {
      await mutate((r) => r.createPlayer({ name, pos: pos || null }))
      setName('')
      setPos('')
    })

  const onPickPhoto = async (file: File | undefined) => {
    const id = fileFor.current
    if (!file || !id) return
    await run(async () => {
      const dataUrl = await compressPhoto(file)
      await mutate((r) => r.updatePlayer(id, { photoUrl: dataUrl }))
    })
  }

  return (
    <Section title={`Elenco · ${used}${plan.maxPlayers ? `/${plan.maxPlayers}` : ''}`}>
      {msg && <Banner tone="danger">{msg}</Banner>}

      <div className="card mb-4 space-y-2 p-3">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Nome do jogador"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select className="input w-24" value={pos} onChange={(e) => setPos(e.target.value as Pos | '')}>
            <option value="">—</option>
            {POSICOES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary w-full" onClick={add} disabled={!name.trim()}>
          Cadastrar jogador
        </button>
      </div>

      {!players.length ? (
        <Empty icon="👤">Nenhum jogador cadastrado.</Empty>
      ) : (
        <div className="card overflow-hidden">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border-b border-line/60 px-3 py-2 last:border-0">
              <button
                onClick={() => {
                  fileFor.current = p.id
                  fileInput.current?.click()
                }}
                title="Trocar foto"
              >
                <Avatar name={p.name} photoUrl={p.photoUrl} size={36} />
              </button>
              <div className="min-w-0 flex-1">
                <button
                  className="block max-w-full truncate text-left text-sm font-semibold"
                  onClick={() => {
                    setRenaming(p)
                    setRenameValue(p.name)
                  }}
                >
                  {p.name}
                </button>
                <span className="tabular text-[11px] text-muted">
                  nota {(ratings.get(p.id) ?? 0).toFixed(1)}
                </span>
              </div>
              <select
                className="input w-20 py-1 text-xs"
                value={p.pos ?? ''}
                onChange={(e) => run(() => mutate((r) => r.updatePlayer(p.id, { pos: (e.target.value || null) as Pos | null })))}
              >
                <option value="">—</option>
                {POSICOES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <button className="btn btn-danger px-2 py-1 text-xs" onClick={() => setConfirmDel(p)}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onPickPhoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <Modal
        open={!!renaming}
        title="Renomear jogador"
        onClose={() => setRenaming(null)}
        footer={
          <>
            <button className="btn" onClick={() => setRenaming(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() =>
                run(async () => {
                  await mutate((r) => r.updatePlayer(renaming!.id, { name: renameValue }))
                  setRenaming(null)
                })
              }
            >
              Salvar
            </button>
          </>
        }
      >
        <input
          className="input"
          maxLength={30}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
        />
      </Modal>

      <Modal
        open={!!confirmDel}
        title="Excluir jogador"
        onClose={() => setConfirmDel(null)}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDel(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-danger"
              onClick={() =>
                run(async () => {
                  await mutate((r) => r.deletePlayer(confirmDel!.id))
                  setConfirmDel(null)
                })
              }
            >
              Excluir
            </button>
          </>
        }
      >
        <p className="text-muted">
          Excluir <b className="text-ink">{confirmDel?.name}</b>? Quem já tem partida registrada não pode ser
          excluído, para não furar o histórico.
        </p>
      </Modal>

      <UpgradeModal payload={limit} onClose={() => setLimit(null)} />
    </Section>
  )
}
