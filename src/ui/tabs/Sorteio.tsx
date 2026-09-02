import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRatings, useStore } from '../../data/store'
import { FORMACOES, POSICOES, parseFormation, type FormationCode } from '../../domain/constants'
import { DrawError, draw, newSeed, type Candidate } from '../../domain/draw'
import { entriesFromLineup, todayISO } from '../../domain/match'
import { importRoster } from '../../domain/roster'
import type { Lineup, Pos } from '../../domain/types'
import LineupView from '../components/LineupView'
import { Avatar, Banner, Modal, Section } from '../components/ui'

interface Confirmed {
  id: string
  name: string
  pos: Pos | null
  avulso: boolean
  gk: boolean
}

export default function Sorteio() {
  const data = useStore((s) => s.data!)
  const mutate = useStore((s) => s.mutate)
  const { byId: ratings, avg } = useRatings()
  const nav = useNavigate()

  const [formB, setFormB] = useState<FormationCode>('2-1-2-1')
  const [formP, setFormP] = useState<FormationCode>('2-1-2-1')
  const [list, setList] = useState<Confirmed[]>([])
  const [lineup, setLineup] = useState<Lineup | null>(null)
  const [seedInput, setSeedInput] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [missing, setMissing] = useState<string[] | null>(null)
  const [avulsoName, setAvulsoName] = useState('')
  const [avulsoPos, setAvulsoPos] = useState<Pos | ''>('')
  const [date, setDate] = useState(() => todayISO(data.tenant.branding.timezone))

  const roster = useMemo(
    () => data.players.filter((p) => !p.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [data.players],
  )
  const inList = new Set(list.map((c) => c.id))
  const gkCount = list.filter((c) => c.gk).length
  const need = parseFormation(formB).ZAG + parseFormation(formB).VOL + parseFormation(formB).MC + parseFormation(formB).ATA
  const needP = parseFormation(formP).ZAG + parseFormation(formP).VOL + parseFormation(formP).MC + parseFormation(formP).ATA

  const add = (p: { id: string; name: string; pos: Pos | null }, avulso = false) =>
    setList((l) => (l.some((c) => c.id === p.id) ? l : [...l, { ...p, avulso, gk: p.pos === 'GOL' && l.filter((c) => c.gk).length < 2 }]))

  const move = (i: number, dir: -1 | 1) =>
    setList((l) => {
      const j = i + dir
      if (j < 0 || j >= l.length) return l
      const next = [...l]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const importPaste = () => {
    const { found, missing: miss } = importRoster(pasteText, roster)
    // a ordem da lista E a ordem de confirmacao: os ultimos viram reservas
    const next: Confirmed[] = []
    for (const { player, posOverride } of found) {
      const pos = posOverride ?? player.pos
      next.push({ id: player.id, name: player.name, pos, avulso: false, gk: pos === 'GOL' && next.filter((c) => c.gk).length < 2 })
    }
    setList(next)
    setPasteOpen(false)
    setPasteText('')
    if (miss.length) setMissing(miss)
  }

  const addAvulso = () => {
    const name = avulsoName.trim()
    if (!name) return
    add({ id: `av-${Math.random().toString(36).slice(2, 8)}`, name, pos: (avulsoPos || null) as Pos | null }, true)
    setAvulsoName('')
    setAvulsoPos('')
  }

  const sortear = () => {
    setMsg(null)
    const candidates: Candidate[] = list.map((c) => ({
      id: c.id,
      name: c.name,
      pos: c.pos,
      // avulso e quem nunca jogou recebem a media do grupo
      rating: c.avulso ? avg : (ratings.get(c.id) ?? avg),
      avulso: c.avulso,
    }))
    try {
      const seed = seedInput.trim() ? Number(seedInput.trim()) : newSeed()
      const out = draw(candidates, parseFormation(formB), parseFormation(formP), {
        gkIds: list.filter((c) => c.gk).map((c) => c.id),
        seed,
      })
      setLineup(out)
      setSeedInput(String(out.seed))
    } catch (e) {
      setMsg(e instanceof DrawError ? e.message : (e as Error).message)
      setLineup(null)
    }
  }

  const salvar = async () => {
    if (!lineup) return
    setMsg(null)
    try {
      const m = await mutate((r) =>
        r.createMatch({ date, lineup, entries: entriesFromLineup(lineup), pending: true, escalaPub: false }),
      )
      nav(`../escalacao?id=${m.id}`)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <Section title="Escalação e sorteio">
      {msg && <Banner tone="danger">{msg}</Banner>}

      <div className="card mb-3 space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="label">{data.tenant.branding.teamNames.branco} ({need} na linha)</span>
            <select className="input" value={formB} onChange={(e) => setFormB(e.target.value as FormationCode)}>
              {FORMACOES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">{data.tenant.branding.teamNames.preto} ({needP} na linha)</span>
            <select className="input" value={formP} onChange={(e) => setFormP(e.target.value as FormationCode)}>
              {FORMACOES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-muted">Ordem ZAG-VOL-MC-ATA, sempre 6 na linha mais o goleiro.</p>
      </div>

      <div className="card mb-3 space-y-2 p-3">
        <button className="btn w-full" onClick={() => setPasteOpen(true)}>
          📋 Colar lista do WhatsApp
        </button>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Avulso (não mensalista)"
            value={avulsoName}
            onChange={(e) => setAvulsoName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAvulso()}
          />
          <select className="input w-20" value={avulsoPos} onChange={(e) => setAvulsoPos(e.target.value as Pos | '')}>
            <option value="">—</option>
            {POSICOES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn" onClick={addAvulso}>+</button>
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">
            Confirmados · {list.length} · goleiros {gkCount}/2
          </span>
          {!!list.length && (
            <button className="btn px-2 py-1 text-xs" onClick={() => { setList([]); setLineup(null) }}>
              Limpar
            </button>
          )}
        </div>
        <div className="card overflow-hidden">
          {!list.length && <p className="px-3 py-6 text-center text-xs text-muted">Marque quem confirmou. A ordem manda: quem confirma primeiro é titular.</p>}
          {list.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 border-b border-line/60 px-2 py-1.5 last:border-0">
              <span className="tabular w-5 text-center text-[11px] font-bold text-muted">{i + 1}</span>
              <div className="flex flex-col">
                <button className="text-[9px] leading-none text-muted" onClick={() => move(i, -1)}>▲</button>
                <button className="text-[9px] leading-none text-muted" onClick={() => move(i, 1)}>▼</button>
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {c.name} {c.avulso && <span className="chip ml-1">avulso</span>}
              </span>
              <span className="chip">{c.pos ?? '—'}</span>
              <button
                className={`btn px-2 py-1 text-xs ${c.gk ? 'btn-primary' : ''}`}
                onClick={() => setList((l) => l.map((x) => (x.id === c.id ? { ...x, gk: !x.gk } : x)))}
                title="Goleiro"
              >
                🧤
              </button>
              <button className="btn btn-danger px-2 py-1 text-xs" onClick={() => setList((l) => l.filter((x) => x.id !== c.id))}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <span className="label">Elenco</span>
        <div className="flex flex-wrap gap-1.5">
          {roster.map((p) => (
            <button
              key={p.id}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                inList.has(p.id) ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line bg-card2 text-muted'
              }`}
              onClick={() => (inList.has(p.id) ? setList((l) => l.filter((c) => c.id !== p.id)) : add(p))}
            >
              <Avatar name={p.name} photoUrl={p.photoUrl} size={18} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-3 space-y-2 p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <span className="label">Semente (opcional)</span>
            <input
              className="input"
              inputMode="numeric"
              placeholder="deixe vazio para sortear"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={sortear}>⚖️ Sortear</button>
        </div>
        <p className="text-[11px] text-muted">
          Guarde a semente: repetindo o mesmo número com a mesma lista, o sorteio sai idêntico. É a prova de
          que não teve marmelada.
        </p>
      </div>

      {lineup && (
        <>
          <LineupView lineup={lineup} branding={data.tenant.branding} />
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <span className="label">Data da partida</span>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => void salvar()}>
              Salvar escalação
            </button>
          </div>
        </>
      )}

      <Modal
        open={pasteOpen}
        title="Colar lista do WhatsApp"
        onClose={() => setPasteOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setPasteOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={importPaste}>Importar</button>
          </>
        }
      >
        <p className="mb-2 text-xs text-muted">
          Um nome por linha. Numeração é ignorada. Sufixo <code>(ZAG)</code> troca a posição só neste sorteio.
          A ordem da lista define quem é titular.
        </p>
        <textarea
          className="input h-56 font-mono text-xs"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={'1 - Marcelo (GOL)\n2. Doleski\n3) Anderson\n• Felipe (ATA)'}
        />
      </Modal>

      <Modal open={!!missing} title="Não encontrados no elenco" onClose={() => setMissing(null)}>
        <p className="mb-2 text-xs text-muted">
          Estes nomes não casaram com ninguém. Cadastre no elenco ou adicione como avulso.
        </p>
        <ul className="ml-4 list-disc">
          {missing?.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Modal>
    </Section>
  )
}
