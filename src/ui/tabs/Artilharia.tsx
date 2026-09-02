import { useMemo } from 'react'
import { useScorers, useStore } from '../../data/store'
import { buildDisp } from '../../domain/names'
import { Avatar, Empty, Section } from '../components/ui'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Artilharia() {
  const { rows, total } = useScorers()
  const players = useStore((s) => s.data?.players ?? [])
  const photo = (id: string) => players.find((p) => p.id === id)?.photoUrl ?? null
  const disp = useMemo(() => buildDisp(rows), [rows])

  return (
    <Section title="Artilharia">
      {!rows.length ? (
        <Empty icon="⚽">Nenhum gol registrado ainda.</Empty>
      ) : (
        <>
          <div className="card mb-3 flex items-center justify-between px-4 py-3">
            <span className="text-xs uppercase tracking-wide text-muted">Gols no campeonato</span>
            <span className="tabular text-2xl font-extrabold text-accent">{total}</span>
          </div>
          <div className="card overflow-hidden">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-0"
              >
                <span className="w-6 text-center text-xs font-bold text-muted">
                  {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
                </span>
                <Avatar name={r.name} photoUrl={photo(r.id)} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold" title={r.name}>
                    {disp.get(r.id) ?? r.name}
                  </div>
                  <div className="tabular text-[11px] text-muted">
                    {r.games} {r.games === 1 ? 'jogo' : 'jogos'} · {r.avg.toFixed(2)} por jogo
                  </div>
                </div>
                <span className="tabular text-lg font-extrabold text-accent">{r.goals}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  )
}
