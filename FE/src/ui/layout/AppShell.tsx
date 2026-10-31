import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { useSession } from '../store/session'
import { Footer } from './Footer'
import styles from './AppShell.module.css'

/** Root layout: screen + footer with the fan game disclaimer. */
export function AppShell() {
  const sessionExpired = useSession((s) => s.sessionExpired)
  const clearExpired = useSession((s) => s.clearExpired)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!sessionExpired) return
    clearExpired()
    navigate('/login', { replace: true, state: { expired: true } })
  }, [sessionExpired, clearExpired, navigate])

  const inGame = pathname === '/play'
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      {!inGame && <Footer />}
    </div>
  )
}

/** Guards /ripperdoc and /account: guests go to /login. */
export function RequireAuth() {
  const status = useSession((s) => s.status)
  const { pathname } = useLocation()
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: pathname }} />
  return <Outlet />
}
