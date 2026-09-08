import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { authEnabled } from './data/auth'
import { useAccessMode, useIsAdmin, useStore } from './data/store'
import { PALETA_DEFAULT } from './domain/constants'
import type { TenantBranding } from './domain/types'
import Login from './ui/Login'
import { Banner } from './ui/components/ui'
import Ranking from './ui/tabs/Ranking'
import Artilharia from './ui/tabs/Artilharia'
import Jogadores from './ui/tabs/Jogadores'
import NovaPartida from './ui/tabs/NovaPartida'
import Sorteio from './ui/tabs/Sorteio'
import EscalacaoDia from './ui/tabs/EscalacaoDia'
import Craque from './ui/tabs/Craque'
import Historico from './ui/tabs/Historico'
import Regras from './ui/tabs/Regras'
import Assinatura from './ui/tabs/Assinatura'

interface Tab {
  to: string
  icon: string
  label: string
  admin?: boolean
}

const TABS: Tab[] = [
  { to: 'ranking', icon: '🏆', label: 'Ranking' },
  { to: 'artilharia', icon: '⚽', label: 'Artilharia' },
  { to: 'escalacao', icon: '🟢', label: 'Escalação' },
  { to: 'craque', icon: '⭐', label: 'Craque' },
  { to: 'historico', icon: '📅', label: 'Histórico' },
  { to: 'jogadores', icon: '👤', label: 'Jogadores', admin: true },
  { to: 'partida', icon: '➕', label: 'Partida', admin: true },
  { to: 'sorteio', icon: '⚖️', label: 'Sorteio', admin: true },
  { to: 'regras', icon: '📜', label: 'Regras' },
]

/** White-label: a cor primaria do tenant vira as CSS vars do tema. */
function applyTheme(branding: TenantBranding) {
  const root = document.documentElement
  root.style.setProperty('--accent', branding.primaryColor || PALETA_DEFAULT.accent)
  root.style.setProperty('--accent2', shade(branding.primaryColor || PALETA_DEFAULT.accent, -0.18))
}

function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(c + c * amount))),
  )
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export default function App() {
  const { slug = 'demo' } = useParams()
  const { data, loading, error, load, role, setRole } = useStore()
  const user = useStore((s) => s.user)
  const authReady = useStore((s) => s.authReady)
  const initAuth = useStore((s) => s.initAuth)
  const sair = useStore((s) => s.signOut)
  const isAdmin = useIsAdmin()
  const access = useAccessMode()

  useEffect(() => {
    void initAuth()
  }, [initAuth])

  useEffect(() => {
    // No modo Supabase so faz sentido carregar depois que existe sessao.
    if (authEnabled && !user) return
    void load(slug)
  }, [slug, load, user])

  useEffect(() => {
    if (data) applyTheme(data.tenant.branding)
  }, [data])

  if (authEnabled && !authReady) {
    return <div className="grid h-full place-items-center text-sm text-muted">Verificando…</div>
  }
  if (authEnabled && !user) {
    return <Login />
  }

  if (loading) {
    return <div className="grid h-full place-items-center text-sm text-muted">Carregando…</div>
  }
  if (error || !data) {
    return <div className="grid h-full place-items-center px-6 text-center text-sm text-danger">{error}</div>
  }

  const b = data.tenant.branding
  const tabs = TABS.filter((t) => !t.admin || isAdmin)

  return (
    <div className={`min-h-full ${isAdmin ? 'is-admin' : ''}`}>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {b.logoUrl ? (
            <img src={b.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-black">⚽</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold leading-tight">{b.name}</div>
            {b.tagline && <div className="truncate text-[11px] text-muted">{b.tagline}</div>}
          </div>
          {authEnabled ? (
            <button className="btn px-2 py-1 text-xs" onClick={() => void sair()} title="Sair da conta">
              Sair
            </button>
          ) : (
            /* Toggle de demonstracao: so no modo local, onde nao existe conta. */
            <button
              className="btn px-2 py-1 text-xs"
              onClick={() => setRole(isAdmin ? 'viewer' : 'admin')}
              title={isAdmin ? 'Sair do modo admin' : 'Entrar no modo admin'}
            >
              {isAdmin ? '🔓 Admin' : '🔒 Atleta'}
            </button>
          )}
        </div>
      </header>

      <main className="safe-bottom mx-auto max-w-2xl px-4 pt-4">
        {access === 'read_only' && (
          <Banner tone="danger">
            Assinatura vencida. O grupo está em <b>somente leitura</b>. Nenhum dado foi apagado.
          </Banner>
        )}
        {access === 'over_limit' && (
          <Banner tone="warn">
            Você está acima do limite do plano. Leitura liberada, cadastro de novos jogadores bloqueado.
          </Banner>
        )}
        {!authEnabled && isAdmin && role === 'admin' && (
          <Banner>
            Modo admin local, para demonstração. Com o Supabase configurado, o papel vem de{' '}
            <b>memberships</b> e este atalho não existe.
          </Banner>
        )}

        <Routes>
          <Route index element={<Navigate to="ranking" replace />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="artilharia" element={<Artilharia />} />
          <Route path="escalacao" element={<EscalacaoDia />} />
          <Route path="craque" element={<Craque />} />
          <Route path="historico" element={<Historico />} />
          <Route path="regras" element={<Regras />} />
          <Route path="assinatura" element={<Assinatura />} />
          <Route path="jogadores" element={isAdmin ? <Jogadores /> : <Navigate to="../ranking" replace />} />
          <Route path="partida" element={isAdmin ? <NovaPartida /> : <Navigate to="../ranking" replace />} />
          <Route path="sorteio" element={isAdmin ? <Sorteio /> : <Navigate to="../ranking" replace />} />
          <Route path="*" element={<Navigate to="ranking" replace />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
        <div className="nav-scroll mx-auto flex max-w-2xl gap-1 overflow-x-auto px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                [
                  'flex min-w-[3.75rem] flex-1 shrink-0 flex-col items-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[10px] font-semibold transition',
                  isActive ? 'bg-card2 text-accent' : 'text-muted',
                ].join(' ')
              }
            >
              <span className="text-base leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
