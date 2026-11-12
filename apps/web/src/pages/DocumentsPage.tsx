import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  ACCEPTED_EXTENSIONS,
  ApiError,
  documentsQueryKey,
  listDocuments,
  MAX_UPLOAD_BYTES,
  uploadDocument,
  validateFile,
  type DocumentOut,
  type DocumentStatus,
} from '../api/documents'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import page from '../shell/page.module.css'
import styles from './DocumentsPage.module.css'

const MAX_PARALLEL = 3

type Upload = {
  key: string
  file: File
  state: 'waiting' | 'uploading' | 'failed'
  progress: number
  error?: string
  /** False for files that failed client-side checks: retrying would fail the same way. */
  retryable: boolean
}

export function DocumentsPage() {
  const queryClient = useQueryClient()
  const docs = useQuery({
    queryKey: documentsQueryKey,
    queryFn: ({ signal }) => listDocuments(signal),
    // Keep statuses fresh while ingestion is working through something.
    refetchInterval: (q) =>
      q.state.data?.some((d) => d.status === 'queued' || d.status === 'indexing') ? 5000 : false,
    // A 4xx won't fix itself on retry.
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  })

  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scheduling lives in refs so finishing one upload can start the next without an effect.
  const waiting = useRef<Upload[]>([])
  const running = useRef(0)
  const controllers = useRef(new Map<string, AbortController>())

  // Plain functions: they only touch refs and stable setters, so a callback holding an older copy
  // (an upload finishing after a re-render) still does the right thing.
  function patch(key: string, change: Partial<Upload>) {
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...change } : u)))
  }

  function remove(key: string) {
    setUploads((list) => list.filter((u) => u.key !== key))
  }

  /** Starts waiting uploads until MAX_PARALLEL are running; each one finishing calls it again. */
  function pump() {
    while (running.current < MAX_PARALLEL && waiting.current.length) {
      const item = waiting.current.shift()!
      const controller = new AbortController()
      controllers.current.set(item.key, controller)
      running.current++
      patch(item.key, { state: 'uploading', progress: 0, error: undefined })

      uploadDocument(item.file, {
        signal: controller.signal,
        onProgress: (progress) => patch(item.key, { progress }),
      })
        .then((doc) => {
          remove(item.key)
          // Show it in the list straight away, then reconcile with the server.
          queryClient.setQueryData<DocumentOut[]>(documentsQueryKey, (old) => [
            doc,
            ...(old ?? []).filter((d) => d.id !== doc.id),
          ])
          void queryClient.invalidateQueries({ queryKey: documentsQueryKey })
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return // cancel() already removed it
          const error =
            err instanceof ApiError
              ? err.message
              : 'Couldn’t reach the server. Check your connection and try again.'
          // 413/415 will fail again unchanged; anything else is worth a retry.
          const retryable = !(err instanceof ApiError && [413, 415].includes(err.status))
          patch(item.key, { state: 'failed', error, retryable })
        })
        .finally(() => {
          controllers.current.delete(item.key)
          running.current--
          pump()
        })
    }
  }

  const addFiles = (files: Iterable<File>) => {
    const items: Upload[] = Array.from(files, (file) => {
      const error = validateFile(file)
      return {
        key: crypto.randomUUID(),
        file,
        state: error ? 'failed' : 'waiting',
        progress: 0,
        error,
        retryable: !error,
      }
    })
    if (!items.length) return
    setUploads((list) => [...list, ...items])
    waiting.current.push(...items.filter((u) => u.state === 'waiting'))
    pump()
  }

  const retry = (item: Upload) => {
    patch(item.key, { state: 'waiting', progress: 0, error: undefined })
    waiting.current.push(item)
    pump()
  }

  const cancel = (item: Upload) => {
    waiting.current = waiting.current.filter((u) => u.key !== item.key)
    controllers.current.get(item.key)?.abort()
    remove(item.key)
  }

  // Leaving the page cancels uploads in flight and drops the queue, so nothing starts after unmount.
  useEffect(() => {
    const live = controllers.current
    return () => {
      waiting.current = []
      live.forEach((c) => c.abort())
    }
  }, [])

  // Closing the tab mid-upload loses the files, so ask first.
  const busy = uploads.some((u) => u.state !== 'failed')
  useEffect(() => {
    if (!busy) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [busy])

  // A file dropped just outside the zone would otherwise make the browser navigate to it.
  useEffect(() => {
    const block = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }
  const onDragLeave = (e: DragEvent) => {
    // Ignore leaving into a child element.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const uploadingCount = uploads.filter((u) => u.state !== 'failed').length

  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>Documents</h1>
        <p className={page.subtitle}>Upload the files the bot should answer from.</p>
      </header>

      <div
        className={styles.dropzone}
        data-dragging={dragging || undefined}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <span className={styles.dropIcon}>
          <Icon name="upload" width={20} height={20} />
        </span>
        <p className={styles.dropTitle}>{dragging ? 'Drop to upload' : 'Drag files here to upload'}</p>
        <p className={styles.dropHint}>
          PDF, DOCX, TXT or Markdown · up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB each
        </p>
        <Button type="button" variant="primary" className={styles.browse} onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className={styles.input}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = '' // so choosing the same file again still fires change
          }}
        />
      </div>

      {uploads.length > 0 && (
        <section className={styles.section} aria-labelledby="uploads-heading">
          <h2 id="uploads-heading" className={styles.sectionTitle}>
            Uploads
            {uploadingCount > 0 && <span className={styles.count}>{uploadingCount} in progress</span>}
          </h2>
          <ul className={styles.list}>
            {uploads.map((u) => (
              <UploadRow
                key={u.key}
                upload={u}
                onCancel={() => cancel(u)}
                onRetry={() => retry(u)}
                onDismiss={() => remove(u.key)}
              />
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="library-heading">
        <h2 id="library-heading" className={styles.sectionTitle}>
          Your documents
          {docs.data && docs.data.length > 0 && <span className={styles.count}>{docs.data.length}</span>}
        </h2>
        <Library query={docs} />
      </section>
    </div>
  )
}

function UploadRow({
  upload: u,
  onCancel,
  onRetry,
  onDismiss,
}: {
  upload: Upload
  onCancel: () => void
  onRetry: () => void
  onDismiss: () => void
}) {
  const pct = Math.round(u.progress * 100)
  return (
    <li className={styles.row} data-failed={u.state === 'failed' || undefined}>
      <span className={styles.fileIcon}>
        <Icon name={u.state === 'failed' ? 'alert' : 'file'} />
      </span>
      <div className={styles.rowMain}>
        <span className={styles.fileName} title={u.file.name}>
          {u.file.name}
        </span>
        {u.state === 'failed' ? (
          <span className={styles.rowError} role="alert">
            {u.error}
          </span>
        ) : (
          <>
            <span className={styles.rowMeta}>
              {formatBytes(u.file.size)} · {u.state === 'waiting' ? 'Waiting…' : pct >= 100 ? 'Processing…' : `${pct}%`}
            </span>
            <span
              className={styles.progress}
              role="progressbar"
              aria-label={`Uploading ${u.file.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={u.state === 'uploading' ? pct : undefined}
            >
              <span className={styles.progressBar} style={{ width: `${u.state === 'uploading' ? pct : 0}%` }} />
            </span>
          </>
        )}
      </div>
      <div className={styles.rowActions}>
        {u.state === 'failed' ? (
          <>
            {u.retryable && (
              <button type="button" className={styles.iconButton} onClick={onRetry} aria-label={`Retry ${u.file.name}`} title="Retry">
                <Icon name="retry" />
              </button>
            )}
            <button type="button" className={styles.iconButton} onClick={onDismiss} aria-label={`Dismiss ${u.file.name}`} title="Dismiss">
              <Icon name="close" />
            </button>
          </>
        ) : (
          <button type="button" className={styles.iconButton} onClick={onCancel} aria-label={`Cancel upload of ${u.file.name}`} title="Cancel">
            <Icon name="close" />
          </button>
        )}
      </div>
    </li>
  )
}

function Library({ query }: { query: UseQueryResult<DocumentOut[], Error> }) {
  if (query.isPending) {
    return (
      <ul className={styles.list} aria-busy="true" aria-label="Loading documents">
        {[0, 1, 2].map((i) => (
          <li key={i} className={styles.row}>
            <span className={`${styles.skeleton} ${styles.skeletonIcon}`} />
            <span className={`${styles.skeleton} ${styles.skeletonText}`} />
          </li>
        ))}
      </ul>
    )
  }

  if (query.isError) {
    return (
      <div className={page.empty} role="alert">
        <span className={page.cardIcon}>
          <Icon name="alert" />
        </span>
        <p className={page.emptyTitle}>Couldn’t load your documents</p>
        <p className={page.emptyText}>{query.error.message}</p>
        <Button type="button" variant="ghost" onClick={() => query.refetch()} loading={query.isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  if (!query.data.length) {
    return (
      <div className={page.empty}>
        <span className={page.cardIcon}>
          <Icon name="file" />
        </span>
        <p className={page.emptyTitle}>No documents yet</p>
        <p className={page.emptyText}>Files you upload will show up here while they’re processed.</p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {query.data.map((doc) => (
        <li key={doc.id} className={styles.row}>
          <span className={styles.fileIcon}>
            <Icon name="file" />
          </span>
          <div className={styles.rowMain}>
            <span className={styles.fileName} title={doc.filename}>
              {doc.filename}
            </span>
            {doc.status === 'failed' && doc.error ? (
              <span className={styles.rowError}>{doc.error}</span>
            ) : (
              <span className={styles.rowMeta}>
                Updated <time dateTime={doc.updated_at}>{formatRelative(doc.updated_at)}</time>
              </span>
            )}
          </div>
          <StatusBadge status={doc.status} />
        </li>
      ))}
    </ul>
  )
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  queued: 'Queued',
  indexing: 'Indexing',
  ready: 'Ready',
  failed: 'Failed',
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={styles.badge} data-status={status}>
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
function formatRelative(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  if (Number.isNaN(seconds)) return ''
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(seconds / 86400), 'day')
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
