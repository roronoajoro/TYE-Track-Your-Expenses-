import { useState } from 'react'
import ParticleCanvas from './components/ParticleCanvas'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'

export default function App() {
  // Session-only: clears when browser tab is closed (privacy fix)
  const [page, setPage] = useState(() => {
    try {
      const stored = sessionStorage.getItem('tye_user')
      if (stored) return 'dashboard'
    } catch {}
    return 'landing'
  })

  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('tye_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  function handleLogin(userData) {
    // Backend returns { user_id, name, email, picture, ... }
    // Normalise to { id, name, email, picture } for consistency throughout the app
    const normalised = {
      id: userData.user_id ?? userData.id,
      name: userData.name,
      email: userData.email,
      picture: userData.picture ?? null,
    }
    sessionStorage.setItem('tye_user', JSON.stringify(normalised))
    setUser(normalised)
    setPage('dashboard')
  }

  function handleLogout() {
    sessionStorage.removeItem('tye_user')
    setUser(null)
    setPage('landing')
  }

  return (
    <>
      <ParticleCanvas />
      {page === 'landing' && <LandingPage onGetStarted={() => setPage('login')} />}
      {page === 'login'   && <LoginPage onLogin={handleLogin} onBack={() => setPage('landing')} />}
      {page === 'dashboard' && user && <Dashboard user={user} onLogout={handleLogout} />}
    </>
  )
}