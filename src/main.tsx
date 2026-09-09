import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import Onboarding from './ui/Onboarding'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        {/* Rota por slug desde o primeiro commit: multi-tenant nao e retrofit. */}
        <Route path="/t/:slug/*" element={<App />} />
        {/* Fora do /t/: criar grupo acontece antes de existir slug. */}
        <Route path="/novo" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/t/demo/ranking" replace />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
