import { describe, expect, it } from 'vitest'
import { isTransientError, withRetry } from './retry'

describe('withRetry', () => {
  it('retries until success within the attempt budget', async () => {
    let attempts = 0
    const result = await withRetry(
      async () => {
        attempts++
        if (attempts < 3) throw new Error('flaky')
        return 'ok'
      },
      { retries: 2 },
    )
    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })

  it('stops immediately on a non-retryable error', async () => {
    let attempts = 0
    await expect(
      withRetry(
        async () => {
          attempts++
          const err = new Error('gone') as Error & {
            response?: { status?: number }
          }
          err.response = { status: 404 }
          throw err
        },
        { retries: 2, isRetryable: isTransientError },
      ),
    ).rejects.toThrow('gone')
    expect(attempts).toBe(1)
  })

  it('rethrows the last error after exhausting retries', async () => {
    let attempts = 0
    await expect(
      withRetry(
        async () => {
          attempts++
          throw new Error(`fail ${attempts}`)
        },
        { retries: 1 },
      ),
    ).rejects.toThrow('fail 2')
    expect(attempts).toBe(2)
  })
})

describe('isTransientError', () => {
  it('treats network-layer errors (no response) as transient', () => {
    expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('treats 429 and 5xx as transient', () => {
    expect(isTransientError({ response: { status: 429 } })).toBe(true)
    expect(isTransientError({ response: { status: 503 } })).toBe(true)
  })

  it('treats definitive 4xx as not transient', () => {
    expect(isTransientError({ response: { status: 404 } })).toBe(false)
    expect(isTransientError({ response: { status: 403 } })).toBe(false)
  })
})
