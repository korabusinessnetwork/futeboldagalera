import { useMemo } from 'react'
import { useRanking, useSeasons, useStore } from '../../data/store'
import { buildDisp } from '../../domain/names'
import { Avatar, Empty, Section } from '../components/ui'

const MEDALS = ['🥇', '🥈', '🥉']

const ROW_TONE = [
  'bg-gradient-to-r from-gold/20 to-transparent border-gold/30',
  'bg-gradient-to-r from-silver/15 to-transparent border-silver/25',
  'bg-gradient-to-r from-bronze/20 to-transparent border-bronze/30',
]

export default function Ranking() {
  const rows = useRanking()
  const seasons = useSeasons()
  const season = useStore((s) => s.season)
  const setSeason = useStore((s) => s.setSeason)
  const players = useStore((s) => s.data?.players ?? [])
  const photo = (id: string) => players.find((p) => p.id === id)?.photoUrl ?? null
  // primeiro nome, desambiguado, que e como o grupo se chama (secao 4.4)
  const disp = useMemo(() => buildDisp(rows), [rows])

  return (
    <Section
      title="Classificação"
      right={
        seasons.length > 1 && (
          <select
            className="input w-auto py-1 text-xs"
            value={season ?? ''}
            onChange={(e) => setSeason(e.target.value || null)}
          >
            <option value="">Todas as temporadas</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )
      }
    >
      {!rows.length ? (
        <Empty icon="🏆">Nenhuma partida encerrada ainda. O ranking aparece assim que a primeira for finalizada.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <div className="tabular grid grid-cols-[1.7rem_1fr_2.1rem_1.6rem_1.6rem_1.6rem_1.6rem_2.7rem] gap-1 border-b border-line px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-muted">
            <span>#</span>
            <span>Jogador</span>
            <span className="text-right">PTS</span>
            <span className="text-right">J</span>
            <span className="text-right">V</span>
            <span className="text-right">E</span>
            <span className="text-right">D</span>
            <span className="text-right">Aprov</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className={`tabular grid grid-cols-[1.7rem_1fr_2.1rem_1.6rem_1.6rem_1.6rem_1.6rem_2.7rem] items-center gap-1 border-b border-line/60 px-2 py-2 text-sm last:border-0 ${
                r.rank <= 3 ? ROW_TONE[r.rank - 1] : ''
              }`}
            >
              <span className="text-center text-xs font-bold text-muted">
                {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={r.name} photoUrl={photo(r.id)} size={24} />
                <span className="truncate font-semibold" title={r.name}>
                  {disp.get(r.id) ?? r.name}
                </span>
              </span>
              <span className="text-right font-extrabold text-accent">{r.pts}</span>
              <span className="text-right text-muted">{r.games}</span>
              <span className="text-right">{r.v}</span>
              <span className="text-right">{r.e}</span>
              <span className="text-right">{r.d}</span>
              <span className="text-right text-muted">{r.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Vitória 4 · Empate 2 · Derrota 1. Gol não pontua. Aproveitamento = pontos ÷ (jogos × 4).
        Empate real divide a mesma posição.
      </p>
    </Section>
  )
}
