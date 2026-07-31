import { describe, expect, it, vi } from 'vitest'
import type { ResolveResult } from './resolve'
import {
  BATCH_CONCURRENCY,
  CANCELLED_ERROR,
  MAX_BATCH_URLS,
  parseBatchInput,
  runBatch,
} from './batchQueue'

describe('parseBatchInput', () => {
  it('splits on newlines and trims', () => {
    expect(parseBatchInput(' https://a.com \n\nhttps://b.com\n')).toEqual([
      'https://a.com',
      'https://b.com',
    ])
  })

  it('splits on spaces and commas too', () => {
    expect(parseBatchInput('https://a.com, https://b.com https://c.com')).toEqual([
      'https://a.com',
      'https://b.com',
      'https://c.com',
    ])
  })

  it('drops duplicates, keeping first order', () => {
    expect(parseBatchInput('https://a.com\nhttps://a.com\nhttps://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ])
  })

  it('caps at MAX_BATCH_URLS', () => {
    const many = Array.from({ length: 30 }, (_, i) => `https://a.com/${i}`).join('\n')
    expect(parseBatchInput(many)).toHaveLength(MAX_BATCH_URLS)
  })

  it('returns an empty array for empty input', () => {
    expect(parseBatchInput('   \n  ')).toEqual([])
  })
})

describe('runBatch', () => {
  it('resolves every url and marks them done', async () => {
    const resolveFn = vi.fn(async () => ({ success: true }))
    const items = await runBatch(['a', 'b', 'c'], resolveFn, () => {})
    expect(resolveFn).toHaveBeenCalledTimes(3)
    expect(items.map((i) => i.status)).toEqual(['done', 'done', 'done'])
  })

  it('marks a rejected url failed without stopping the rest', async () => {
    const resolveFn = vi.fn(async (url: string) => {
      if (url === 'b') throw new Error('boom')
      return { success: true }
    })
    const items = await runBatch(['a', 'b', 'c'], resolveFn, () => {})
    expect(items.map((i) => i.status)).toEqual(['done', 'failed', 'done'])
    expect(items[1].error).toBe('boom')
  })

  it('marks an unsuccessful result failed', async () => {
    const resolveFn = vi.fn(async () => ({ success: false, error: 'nope' }))
    const items = await runBatch(['a'], resolveFn, () => {})
    expect(items[0].status).toBe('failed')
    expect(items[0].error).toBe('nope')
  })

  it('runs exactly BATCH_CONCURRENCY at once, not fewer', async () => {
    let running = 0
    let peak = 0
    const resolveFn = async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return { success: true }
    }
    await runBatch(['a', 'b', 'c', 'd', 'e', 'f'], resolveFn, () => {})
    // Pinned to exactly BATCH_CONCURRENCY (not just <=) so a regression to
    // serial execution (peak 1) fails this test too — six same-duration
    // items with two lanes guarantees a lane reaches 2 concurrently.
    expect(peak).toBe(BATCH_CONCURRENCY)
  })

  it('keeps the other lane busy on a slow item instead of idling behind it (shared cursor, not fixed chunks)', async () => {
    // 'slow' never resolves until the test releases it by hand; every other
    // item resolves immediately. Under the shared-cursor design, the lane
    // that is NOT stuck on 'slow' keeps pulling the next unclaimed index, so
    // b..f all finish while 'slow' is still pending. A fixed-chunk
    // implementation (e.g. lane A = [slow,b,c], lane B = [d,e,f]) would
    // instead strand 'b' and 'c' behind 'slow' in the same lane, so they
    // would NOT have finished yet at the same point — this test fails under
    // that design (verified locally by swapping to fixed chunking: 'b' and
    // 'c' were missing from finishOrder at the checkpoint, see
    // task-13-report.md).
    let releaseSlow: (() => void) | undefined
    const finishOrder: string[] = []

    const resolveFn = (url: string): Promise<ResolveResult> => {
      if (url === 'slow') {
        return new Promise<ResolveResult>((resolve) => {
          releaseSlow = () => {
            finishOrder.push('slow')
            resolve({ success: true })
          }
        })
      }
      finishOrder.push(url)
      return Promise.resolve({ success: true })
    }

    const runPromise = runBatch(['slow', 'b', 'c', 'd', 'e', 'f'], resolveFn, () => {})

    // A real timer (even 0ms) only fires once the microtask queue is fully
    // drained, so by the time this resolves, the other lane has raced
    // through every already-resolved item via the shared cursor — with no
    // dependence on real-timer durations or OS timer granularity.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(finishOrder).toEqual(['b', 'c', 'd', 'e', 'f'])
    expect(releaseSlow).toBeDefined()

    releaseSlow?.()
    await runPromise

    expect(finishOrder).toEqual(['b', 'c', 'd', 'e', 'f', 'slow'])
  })

  it('reports progress through onUpdate', async () => {
    const onUpdate = vi.fn()
    await runBatch(['a', 'b'], async () => ({ success: true }), onUpdate)
    expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(4)
  })

  it('never calls resolveFn when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const resolveFn = vi.fn(async () => ({ success: true }))
    const items = await runBatch(['a', 'b', 'c'], resolveFn, () => {}, controller.signal)
    expect(resolveFn).not.toHaveBeenCalled()
    expect(items.map((i) => i.status)).toEqual(['failed', 'failed', 'failed'])
    expect(items.every((i) => i.error === CANCELLED_ERROR)).toBe(true)
  })

  it('stops handing out new work on abort mid-batch, without cutting in-flight items short', async () => {
    const controller = new AbortController()
    const calls: string[] = []
    const releasers: Record<string, (result: ResolveResult) => void> = {}
    // resolveFn never auto-resolves; the test releases 'a' and 'b' by hand so
    // it can assert exactly what has and hasn't been called at abort time,
    // with no timing races.
    const resolveFn = vi.fn(
      (url: string) =>
        new Promise<ResolveResult>((resolve) => {
          calls.push(url)
          releasers[url] = resolve
        }),
    )

    const runPromise = runBatch(['a', 'b', 'c', 'd'], resolveFn, () => {}, controller.signal)

    // Both lanes claim their first item synchronously (the shared cursor is
    // advanced before either resolveFn call suspends), so by this point 'a'
    // and 'b' are in flight and 'c'/'d' are still queued.
    expect(calls).toEqual(['a', 'b'])

    controller.abort()
    releasers.a({ success: true })
    releasers.b({ success: true })

    const items = await runPromise

    // 'c' and 'd' were never started once the signal fired.
    expect(calls).toEqual(['a', 'b'])
    expect(resolveFn).toHaveBeenCalledTimes(2)

    const byUrl = Object.fromEntries(items.map((i) => [i.url, i]))
    expect(byUrl.a.status).toBe('done')
    expect(byUrl.b.status).toBe('done')
    expect(byUrl.c.status).toBe('failed')
    expect(byUrl.d.status).toBe('failed')
    expect(byUrl.c.error).toBe(CANCELLED_ERROR)
    expect(byUrl.d.error).toBe(CANCELLED_ERROR)
  })

  it('behaves exactly as before when no signal is passed', async () => {
    const resolveFn = vi.fn(async () => ({ success: true }))
    const items = await runBatch(['a', 'b'], resolveFn, () => {})
    expect(items.map((i) => i.status)).toEqual(['done', 'done'])
  })
})
