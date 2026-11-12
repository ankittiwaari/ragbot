import { useSyncExternalStore } from 'react'
import type { LoginDetails } from '../api/generated/model'

/**
 * The signed-in session: the login response, kept in localStorage so a reload stays signed in.
 * The API has no /me endpoint yet, so the stored user is the source of truth for the UI,
 * and the JWT's `exp` claim decides when the session is over.
 */
export type Session = LoginDetails

const KEY = 'rag-bot.session'
const listeners = new Set<() => void>()

// useSyncExternalStore needs a stable snapshot, so cache the parsed value per raw string.
let cachedRaw: string | null = null
let cachedSession: Session | null = null

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      cachedSession = parse(raw)
    }
  } catch {
    // Storage blocked: fall back to whatever this tab saved in memory.
  }
  // Re-checked on every read so an expired token stops counting without a write.
  return cachedSession && !isExpired(cachedSession.token) ? cachedSession : null
}

function parse(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Session
    return value?.token && value?.user ? value : null
  } catch {
    return null
  }
}

/** The token's `exp` as epoch ms, or 0 if it can't be read. Verifying the signature is the server's job. */
export function expiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

function isExpired(token: string): boolean {
  return expiresAt(token) <= Date.now()
}

function notify() {
  for (const listener of listeners) listener()
}

export function saveSession(session: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Storage blocked (private mode etc.): the in-memory cache still carries this tab.
    cachedRaw = JSON.stringify(session)
    cachedSession = session
  }
  notify()
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  cachedRaw = null
  cachedSession = null
  notify()
}

export function getSession(): Session | null {
  return read()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Other tabs logging in or out arrive as storage events.
  const onStorage = (e: StorageEvent) => e.key === KEY && listener()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, read, () => null)
}
