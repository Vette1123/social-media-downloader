import { describe, expect, it, vi } from 'vitest'
import { BATCH_CONCURRENCY, MAX_BATCH_URLS, parseBatchInput, runBatch } from './batchQueue'

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

  it('never runs more than BATCH_CONCURRENCY at once', async () => {
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
    expect(peak).toBeLessThanOrEqual(BATCH_CONCURRENCY)
  })

  it('reports progress through onUpdate', async () => {
    const onUpdate = vi.fn()
    await runBatch(['a', 'b'], async () => ({ success: true }), onUpdate)
    expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(4)
  })
})
