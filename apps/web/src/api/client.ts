/** Helpers for the orval-generated client in ./generated (run `npm run generate:api`). */

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
