import { useStore } from '../../data/store'
import { CRAQUE_DURATION_MIN, CRAQUE_OPEN_MIN } from '../../domain/constants'
import { minuteLabel } from '../../domain/craque'
import { Section } from '../components/ui'

export default function Regras() {
  const branding = useStore((s) => s.data!.tenant.branding)

  return (
    <Section title="Regras">
      <div className="card space-y-4 px-4 py-4 text-sm leading-relaxed">
        <div>
          <h3 className="mb-1 font-bold text-accent">Pontuação</h3>
          <ul className="ml-4 list-disc text-muted">
            <li>Vitória: <b className="text-ink">4 pontos</b></li>
            <li>Empate: <b className="text-ink">2 pontos</b></li>
            <li>Derrota: <b className="text-ink">1 ponto</b></li>
            <li>Gol não vale ponto no ranking, vale na artilharia.</li>
          </ul>
        </div>

        <div>
          <h3 className="mb-1 font-bold text-accent">Critérios de desempate</h3>
          <ol className="ml-4 list-decimal text-muted">
            <li>Pontos</li>
            <li>Vitórias</li>
            <li>Aproveitamento</li>
            <li>Jogos disputados</li>
            <li>Ordem alfabética</li>
          </ol>
          <p className="mt-1 text-xs text-muted">
            Empate em todos os critérios divide a mesma posição, sem desempate artificial.
          </p>
        </div>

        <div>
          <h3 className="mb-1 font-bold text-accent">Sorteio dos times</h3>
          <ul className="ml-4 list-disc text-muted">
            <li>Quem confirma primeiro é titular. Quem confirma por último começa no banco.</li>
            <li>A nota do jogador sai do aproveitamento, da taxa de vitória e dos gols por jogo.</li>
            <li>
              O sorteio recebe uma semente: dá para reproduzir o mesmo sorteio e conferir que não teve
              marmelada.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-1 font-bold text-accent">Craque do jogo</h3>
          <p className="text-muted">
            A votação abre <b className="text-ink">{minuteLabel(CRAQUE_OPEN_MIN)}</b> no dia da partida e
            dura <b className="text-ink">{CRAQUE_DURATION_MIN} minutos</b> ({branding.timezone}) — depois
            fecha sozinha. O admin pode abrir antes ou encerrar na hora que quiser. Durante a votação a
            parcial fica escondida, o resultado só aparece no encerramento.
          </p>
        </div>

        <div>
          <h3 className="mb-1 font-bold text-accent">Premiação</h3>
          <p className="text-muted">
            Troféu para o top 3 da temporada. O campeão fica isento da janta de fim de ano.
          </p>
        </div>

        {branding.instagramUrl && (
          <a className="btn btn-primary w-full" href={branding.instagramUrl} target="_blank" rel="noreferrer">
            Siga no Instagram
          </a>
        )}
      </div>
    </Section>
  )
}
