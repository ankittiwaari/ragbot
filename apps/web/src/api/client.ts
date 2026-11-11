/**
 * Minimal fetch wrapper for the FastAPI backend.
 * Requests go to /api/*, which Vite proxies to localhost:8000 in dev.
 * Replace with a client generated from FastAPI's OpenAPI schema once routes exist.
 */

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, message = `Request failed (${status})`) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function apiPost<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiError(0, null, 'Network error')
  }

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body as TResponse
}

/** FastAPI 422 body: { detail: [{ loc: ['body', 'email'], msg: '...' }] } */
export function fieldErrorsFrom422(body: unknown): Record<string, string> {
  const errors: Record<string, string> = {}
  const detail = (body as { detail?: unknown } | null)?.detail
  if (!Array.isArray(detail)) return errors
  for (const item of detail) {
    const field = item?.loc?.at(-1)
    if (typeof field === 'string' && typeof item.msg === 'string') errors[field] ??= item.msg
  }
  return errors
}
