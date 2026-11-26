import { describe, expect, it } from 'vitest'

import { failureCode } from './analyticsErrors'
import { readResolveAnswer } from './resolveAnswer'

const page = (status: number) =>
  new Response('<!DOCTYPE html><html><body>Just a moment...</body></html>', {
    status,
    headers: { 'content-type': 'text/html; charset=UTF-8' },
  })

/**
 * A LinkedIn resolve got an HTML page back from /api/download (2026-11-25) and the
 * visitor read "Unexpected token '<'", filed as our fault with no status.
 */
describe('reading the /api/download answer', () => {
  it('passes a JSON answer through', async () => {
    const res = new Response(JSON.stringify({ success: true }), {
      headers: { 'content-type': 'application/json' },
    })
    await expect(readResolveAnswer(res)).resolves.toEqual({ success: true })
  })

  it('names the status of an HTML page instead of a JSON parse error', async () => {
    const err = await readResolveAnswer(page(403)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).not.toMatch(/Unexpected token/)
    expect((err as Error).message).toMatch(/\bHTTP 403\b/)
    expect((err as { response?: { status?: number } }).response?.status).toBe(403)
  })

  it('files a challenge page as unavailable and an HTML 500 as our fault', async () => {
    const challenge = (await readResolveAnswer(page(403)).catch((e: Error) => e)) as Error
    const crash = (await readResolveAnswer(page(500)).catch((e: Error) => e)) as Error
    expect(failureCode(challenge.message)).toBe('unavailable')
    expect(failureCode(crash.message)).toBe('server')
  })
})
