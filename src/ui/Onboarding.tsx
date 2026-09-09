import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { criarGrupo, onboardingDisponivel } from '../data/onboarding'
import { useStore } from '../data/store'
import { PlanLimitError, type PlanLimitPayload } from '../domain/plan'
import { parseRosterText, type ParsedLine } from '../domain/roster'
import { nomesUnicos, slugify, validarSlug } from '../domain/slug'
import Login from './Login'

/**
 * Onboarding em 3 passos (melhoria 10 da spec): nome do grupo -> colar a lista
 * -> primeiro sorteio. A meta escrita e "primeiro valor em menos de 3 minutos",
 * entao cada passo pede o minimo e nenhum deles bloqueia o seguinte: da para
 * criar o grupo sem tagline e pular a lista inteira.
 *
 * O escudo do passo 1 da spec ainda nao entra: foto e dataURL no localStorage e
 * o Storage por tenant nao existe (docs/06-seguranca.md).
 */
export default function Onboarding() {
  const navigate = useNavigate()
  const user = useStore((s) => s.user)

  if (!onboardingDisponivel) {
    return (
      <Aviso titulo="Só no modo Supabase">
        Criar grupo depende de conta e de <b>memberships</b>, que só existem com o Supabase
        configurado. No modo local o app já abre no grupo de demonstração.
      </Aviso>
    )
  }
  if (!user) return <Login />

  return <Assistente aoTerminar={(slug) => navigate(`/t/${slug}/sorteio`)} />
}

function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center px-6">
      <div className="card w-full max-w-sm p-6 text-center">
        <h1 className="text-lg font-extrabold leading-tight">{titulo}</h1>
        <p className="mt-2 text-xs text-muted">{children}</p>
      </div>
    </div>
  )
}

function Assistente({ aoTerminar }: { aoTerminar: (slug: string) => void }) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1)
  const [nome, setNome] = useState('')
  const [tagline, setTagline] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTocado, setSlugTocado] = useState(false)
  const [lista, setLista] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [criado, setCriado] = useState<string | null>(null)
  const [limite, setLimite] = useState<PlanLimitPayload | null>(null)
  const [foraDaLista, setForaDaLista] = useState<string[]>([])
  const [criados, setCriados] = useState(0)

  // Enquanto ninguem editar o endereco na mao, ele acompanha o nome.
  const slugEfetivo = slugTocado ? slug : slugify(nome)
  const problemaNoSlug = validarSlug(slugEfetivo)

  const linhas: ParsedLine[] = nomesUnicos(parseRosterText(lista))

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return // submit duplo nao cria dois grupos
    if (!nome.trim()) {
      setErro('Informe o nome do grupo.')
      return
    }
    if (problemaNoSlug) {
      setErro(problemaNoSlug)
      return
    }
    setErro(null)
    setEnviando(true)
    try {
      const slugCriado = await criarGrupo({ nome, slug: slugEfetivo, tagline })
      setCriado(slugCriado)
      setPasso(2)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function salvarElenco() {
    if (enviando || !criado) return
    setEnviando(true)
    setErro(null)
    const repo = useStore.getState().repo
    let feitos = 0
    try {
      await repo.load(criado)
      for (let i = 0; i < linhas.length; i++) {
        try {
          await repo.createPlayer({ name: linhas[i].name, pos: linhas[i].posOverride })
          feitos++
        } catch (err) {
          // O grupo nasce no plano free, que para em 12 jogadores. Colar uma
          // lista maior nao pode falhar em silencio nem parar sem dizer quem
          // ficou de fora.
          if (err instanceof PlanLimitError) {
            setLimite(err.payload)
            setForaDaLista(linhas.slice(i).map((l) => l.name))
            break
          }
          throw err
        }
      }
      await useStore.getState().load(criado)
      setCriados(feitos)
      setPasso(3)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-8">
      <ol className="mb-5 flex items-center gap-2 text-[11px] text-muted">
        {(['Grupo', 'Elenco', 'Sorteio'] as const).map((rotulo, i) => (
          <li key={rotulo} className={`flex-1 border-t-2 pt-2 ${passo > i ? 'border-accent text-text' : 'border-line'}`}>
            {i + 1}. {rotulo}
          </li>
        ))}
      </ol>

      {passo === 1 && (
        <form onSubmit={criar} className="card p-6">
          <h1 className="text-lg font-extrabold leading-tight">Criar um grupo</h1>
          <p className="mt-1 text-xs text-muted">Dois campos e você já pode sortear.</p>

          <label className="mt-5 block text-xs font-semibold text-muted" htmlFor="ob-nome">
            Nome do grupo
          </label>
          <input
            id="ob-nome"
            className="input mt-1"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="PMNH & Amigos"
            disabled={enviando}
          />

          <label className="mt-3 block text-xs font-semibold text-muted" htmlFor="ob-tagline">
            Frase do grupo <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="ob-tagline"
            className="input mt-1"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Confusão, Cultura e Ladaia"
            disabled={enviando}
          />

          <label className="mt-3 block text-xs font-semibold text-muted" htmlFor="ob-slug">
            Endereço
          </label>
          <input
            id="ob-slug"
            className="input mt-1"
            value={slugEfetivo}
            onChange={(e) => {
              setSlugTocado(true)
              setSlug(e.target.value)
            }}
            disabled={enviando}
          />
          <p className="mt-1 text-[11px] text-muted">
            O grupo vai abrir em <b>/t/{slugEfetivo || '…'}</b>
          </p>
          {slugEfetivo && problemaNoSlug && (
            <p className="mt-1 text-[11px] text-danger">{problemaNoSlug}</p>
          )}

          {erro && (
            <p role="alert" className="mt-3 text-xs text-danger">
              {erro}
            </p>
          )}

          <button className="btn btn-primary mt-5 w-full" type="submit" disabled={enviando}>
            {enviando ? 'Criando…' : 'Criar grupo'}
          </button>
        </form>
      )}

      {passo === 2 && (
        <div className="card p-6">
          <h1 className="text-lg font-extrabold leading-tight">Quem joga?</h1>
          <p className="mt-1 text-xs text-muted">
            Cole a lista do grupo, um nome por linha. Numeração e “(GOL)” no fim são entendidos.
          </p>

          <textarea
            className="input mt-4 h-44 resize-none font-mono text-xs"
            value={lista}
            onChange={(e) => setLista(e.target.value)}
            placeholder={'1 - Marcelo (GOL)\n2 - Doleski (ZAG)\n3 - Anderson'}
            disabled={enviando}
          />
          <p className="mt-1 text-[11px] text-muted">
            {linhas.length === 0 ? 'Nenhum nome ainda.' : `${linhas.length} jogador(es) reconhecido(s).`}
          </p>

          {erro && (
            <p role="alert" className="mt-3 text-xs text-danger">
              {erro}
            </p>
          )}

          <button
            className="btn btn-primary mt-4 w-full"
            onClick={() => void salvarElenco()}
            disabled={enviando || linhas.length === 0}
          >
            {enviando ? 'Cadastrando…' : 'Cadastrar elenco'}
          </button>
          <button
            className="btn mt-2 w-full"
            onClick={() => setPasso(3)}
            disabled={enviando}
          >
            Pular por agora
          </button>
        </div>
      )}

      {passo === 3 && criado && (
        <div className="card p-6 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-accent text-xl text-black">
            ⚽
          </div>
          <h1 className="mt-3 text-lg font-extrabold leading-tight">Grupo criado</h1>
          <p className="mt-1 text-xs text-muted">
            {criados > 0 ? `${criados} jogador(es) no elenco. ` : ''}
            Agora é só sortear os times.
          </p>

          {limite && (
            <div className="mt-4 rounded-xl border border-line bg-card2 p-3 text-left text-[11px] text-muted">
              O plano atual permite <b>{limite.limit}</b> jogadores, e a lista tinha mais. Ficaram de
              fora: {foraDaLista.join(', ')}.{' '}
              <a className="text-accent underline" href={`#/t/${criado}/assinatura`}>
                Ver planos
              </a>
              . Ninguém foi apagado — é só subir de plano e cadastrar o resto.
            </div>
          )}

          <button className="btn btn-primary mt-5 w-full" onClick={() => aoTerminar(criado)}>
            Fazer o primeiro sorteio
          </button>
          <a className="btn mt-2 block w-full" href={`#/t/${criado}/ranking`}>
            Ir para o grupo
          </a>
        </div>
      )}
    </div>
  )
}
