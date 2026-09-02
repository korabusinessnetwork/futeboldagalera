import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        {/* Rota por slug desde o primeiro commit: multi-tenant nao e retrofit. */}
        <Route path="/t/:slug/*" element={<App />} />
        <Route path="*" element={<Navigate to="/t/demo/ranking" replace />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
