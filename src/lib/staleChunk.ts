/**
 * A tab that outlived a deploy asks for chunks the new deploy no longer has:
 * Workers static assets keep only the current build, so a lazy chunk (the FAQ,
 * motion, a panel) 404s and that part of the page never appears. PostHog saw it
 * as "Failed to load chunk … from module …" on 17 Nov, 6 people in a day.
 *
 * Recovery: when a chunk of ours fails, ask for it again. A 404 means the build
 * moved on, so reload once to pick up the new one. Anything else (offline, a
 * dropped connection) is left alone: a reload would not help and would lose state.
 */

const CHUNK_FAILURE =
  /Failed to load chunk|ChunkLoadError|Loading (CSS )?chunk \S+ failed|Failed to fetch dynamically imported module/i
const OWN_CHUNK = /\/_next\/static\/[^\s'"()]+\.(js|css)/
const RELOADED_KEY = 'smd_stale_chunk_reload'

/** The /_next/static path a chunk-load failure names, or null when it is not one. */
export function missingChunkPath(error: unknown): string | null {
  const message = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message
  if (typeof message !== 'string' || !CHUNK_FAILURE.test(message)) return null
  return OWN_CHUNK.exec(message)?.[0] ?? null
}

/** Reload only for a chunk that is gone, and never twice for the same chunk. */
export function shouldReload(status: number, path: string, lastReloadedFor: string | null): boolean {
  return status === 404 && path !== lastReloadedFor
}

async function recover(error: unknown): Promise<void> {
  const path = missingChunkPath(error)
  if (!path) return
  try {
    const { status } = await fetch(path, { method: 'HEAD', cache: 'no-store' })
    if (!shouldReload(status, path, sessionStorage.getItem(RELOADED_KEY))) return
    sessionStorage.setItem(RELOADED_KEY, path)
    window.location.reload()
  } catch {
    // Offline or storage blocked: leave the page as it is.
  }
}

export function installStaleChunkRecovery(): void {
  window.addEventListener('error', (event) => void recover(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => void recover(event.reason))
}
