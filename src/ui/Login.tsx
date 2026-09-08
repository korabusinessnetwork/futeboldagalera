import { useState, type FormEvent } from 'react'
import { validateCredentials } from '../data/auth'
import { useStore } from '../data/store'

/**
 * Porta de entrada do modo Supabase. Nao tem cadastro nem "esqueci a senha":
 * os dois dependem de envio de e-mail, que ainda nao esta contratado. Enquanto
 * isso as contas nascem no painel do Supabase (ver docs/10-operacao.md).
 *
 * A senha vive so no estado do componente e some com ele — nao vai para o
 * `localStorage` nem para log nenhum.
 */
export default function Login() {
  const signIn = useStore((s) => s.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (enviando) return // submit duplo nao vira duas idas ao servidor
    const invalido = validateCredentials(email, password)
    if (invalido) {
      setErro(invalido)
      return
    }
    setErro(null)
    setEnviando(true)
    try {
      await signIn(email, password)
      setPassword('')
    } catch (err) {
      setErro((err as Error).message)
      setPassword('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-full place-items-center px-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-6">
        <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-accent text-xl text-black">
          ⚽
        </div>
        <h1 className="mt-3 text-lg font-extrabold leading-tight">Entrar</h1>
        <p className="mt-1 text-xs text-muted">
          Use a conta do seu grupo. Ainda não tem? Fale com quem administra a pelada.
        </p>

        <label className="mt-5 block text-xs font-semibold text-muted" htmlFor="login-email">
          E-mail
        </label>
        <input
          id="login-email"
          className="input mt-1"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={enviando}
        />

        <label className="mt-3 block text-xs font-semibold text-muted" htmlFor="login-senha">
          Senha
        </label>
        <input
          id="login-senha"
          className="input mt-1"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={enviando}
        />

        {erro && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {erro}
          </p>
        )}

        <button className="btn btn-primary mt-5 w-full" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
