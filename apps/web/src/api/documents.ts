/**
 * Documents API — hand-written because the backend doesn't expose these endpoints yet.
 * Once it does, regenerate with orval and replace this file with the generated client.
 *
 * Contract this page expects (all calls send `Authorization: Bearer <token>`):
 *   GET  /api/v1/documents   → 200 DocumentOut[]               (newest first)
 *   POST /api/v1/documents   multipart/form-data, field `file`
 *                            → 201 DocumentOut                 (status starts as "queued")
 *                            → 413 { detail } too large · 415 { detail } unsupported type
 *   Any                      → 401 when the token is missing, invalid or expired
 */
import { authHeader, customFetch, handleUnauthorized, parseBody } from './fetcher'

export type DocumentStatus = 'queued' | 'indexing' | 'ready' | 'failed'

export interface DocumentOut {
  id: string
  filename: string
  status: DocumentStatus
  /** Why ingestion failed, when status is "failed". */
  error: string | null
  updated_at: string
}

// Keep in sync with the backend's limits. The server is the authority; these just fail fast.
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'] as const
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const documentsQueryKey = ['documents'] as const

const ENDPOINT = '/api/v1/documents'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function detailOf(data: unknown): string | undefined {
  const detail = (data as { detail?: unknown } | null)?.detail
  return typeof detail === 'string' ? detail : undefined
}

function errorFor(status: number, data: unknown, action: 'load' | 'upload'): ApiError {
  const message =
    status === 401
      ? 'Your session has ended. Please log in again.'
      : status === 404 || status === 405 || status === 501
        ? `${action === 'load' ? 'Listing' : 'Uploading'} documents isn’t available on the server yet.`
        : status === 413
          ? (detailOf(data) ?? `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`)
          : status === 415
            ? (detailOf(data) ?? 'This file type isn’t supported.')
            : (detailOf(data) ??
              (action === 'load' ? 'Couldn’t load your documents.' : 'Upload failed. Please try again.'))
  return new ApiError(status, message)
}

export async function listDocuments(signal?: AbortSignal): Promise<DocumentOut[]> {
  const res = await customFetch<{ data: unknown; status: number }>(ENDPOINT, { signal })
  if (res.status !== 200) throw errorFor(res.status, res.data, 'load')
  return res.data as DocumentOut[]
}

/**
 * Uploads one file. Uses XMLHttpRequest rather than fetch because fetch can't report upload progress.
 * Rejects with ApiError (server said no), TypeError (network) or DOMException 'AbortError' (cancelled).
 */
export function uploadDocument(
  file: File,
  { onProgress, signal }: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<DocumentOut> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Upload cancelled', 'AbortError'))

    const xhr = new XMLHttpRequest()
    const auth = authHeader()
    xhr.open('POST', ENDPOINT)
    for (const [k, v] of Object.entries(auth)) xhr.setRequestHeader(k, v)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      handleUnauthorized(xhr.status, 'Authorization' in auth)
      const data = parseBody(xhr.responseText)
      if (xhr.status === 201 || xhr.status === 200) resolve(data as DocumentOut)
      else reject(errorFor(xhr.status, data, 'upload'))
    }
    xhr.onerror = () => reject(new TypeError('Network error'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })

    const body = new FormData()
    body.append('file', file)
    xhr.send(body)
  })
}

/** Client-side check before uploading; returns the problem, or undefined if the file looks fine. */
export function validateFile(file: File): string | undefined {
  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext))
    return 'Unsupported file type. Use PDF, DOCX, TXT or Markdown.'
  if (file.size === 0) return 'This file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return `Larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
  return undefined
}
