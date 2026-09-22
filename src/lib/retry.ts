// Retry a flaky network op with exponential backoff + light jitter. Only retries
// errors the caller marks retryable (429 / 5xx / timeouts) — a hard 404/private
// post fails fast. Backoff is 400ms, 900ms, ~2s so a transient rate-limit or
// cold-start on a public instance is ridden out instead of surfacing to the user.
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { retries?: number; isRetryable?: (e: unknown) => boolean } = {},
): Promise<T> {
  const retries = opts.retries ?? 2
  const isRetryable = opts.isRetryable ?? (() => true)
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt)
    } catch (e) {
      lastError = e
      if (attempt === retries || !isRetryable(e)) break
      const base = 400 * Math.pow(2.2, attempt)
      const jitter = base * 0.25 * ((attempt % 3) / 3)
      await new Promise((r) => setTimeout(r, Math.round(base + jitter)))
    }
  }
  throw lastError
}

// True for transient failures worth retrying: network timeouts/resets and HTTP
// 429 / 5xx. A definitive 4xx (bad/private/removed post) is NOT retried.
export function isTransientError(e: unknown): boolean {
  const err = e as { code?: string; response?: { status?: number } }
  if (
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ECONNRESET' ||
    err?.code === 'ENOTFOUND'
  ) {
    return true
  }
  const status = err?.response?.status
  if (typeof status === 'number') return status === 429 || status >= 500
  // No response at all (network layer) — worth one more try.
  return err instanceof Error && !('response' in (err as object))
}
