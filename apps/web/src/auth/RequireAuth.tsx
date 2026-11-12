import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { clearSession, expiresAt, useSession } from './session'

/** Renders children only with a live session; otherwise sends the user to /login and back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()

  // Sign out the moment the token expires, not just on the next navigation.
  useEffect(() => {
    if (!session) return
    const ms = expiresAt(session.token) - Date.now()
    // setTimeout overflows above ~24.8 days; tokens here live minutes, but stay safe.
    const id = window.setTimeout(clearSession, Math.min(Math.max(ms, 0), 2 ** 31 - 1))
    return () => window.clearTimeout(id)
  }, [session])

  if (!session) {
    const from = location.pathname + location.search
    return <Navigate to="/login" replace state={{ from }} />
  }
  return children
}

/**
 * The inverse, for /login and /signup: a signed-in user goes straight to the app, back to the page
 * RequireAuth bounced them from if there was one. This is also how a successful login lands in the shell.
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  if (session) {
    const from = (location.state as { from?: unknown } | null)?.from
    // Only follow same-app paths, never `//evil.example`.
    const to = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
    return <Navigate to={to} replace />
  }
  return children
}
