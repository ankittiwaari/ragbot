import { clearSession, getSession } from '../auth/session'

/** `Authorization` header for the current session, if any. */
export function authHeader(): Record<string, string> {
  const token = getSession()?.token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** A 401 on a request that carried a token means it's no longer valid; RequireAuth then sends the user to /login. */
export function handleUnauthorized(status: number, sentToken: boolean) {
  if (status === 401 && sentToken) clearSession()
}

/** Parses a response body as JSON, falling back to the raw text (e.g. a proxy's plain "Internal Server Error"). */
export function parseBody(text: string): unknown {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Authenticated fetch, shaped like orval's fetch client: resolves on non-2xx with `{ data, status, headers }`.
 * It can also be wired in as orval's mutator (`override.mutator`) once generated endpoints need auth.
 */
export async function customFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const auth = authHeader()
  const headers = new Headers(options.headers)
  for (const [k, v] of Object.entries(auth)) headers.set(k, v)

  const res = await fetch(url, { ...options, headers })
  handleUnauthorized(res.status, 'Authorization' in auth)

  const text = [204, 205, 304].includes(res.status) ? '' : await res.text()
  return { data: parseBody(text), status: res.status, headers: res.headers } as T
}
