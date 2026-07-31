import { describe, expect, it } from 'vitest'
import { signToken, verifyToken } from './licenseToken'

const SECRET = 'test-secret-value'
const NOW = 1_800_000_000_000

describe('licenseToken', () => {
  it('round-trips a payload', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const payload = await verifyToken(token, SECRET, NOW)
    expect(payload).toEqual({ k: 'abc123', exp: NOW + 1000 })
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    expect(await verifyToken(token, 'other-secret', NOW)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW - 1 }, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const [, signature] = token.split('.')
    const forged = `${btoa(JSON.stringify({ k: 'hacked', exp: NOW + 1000 }))}.${signature}`
    expect(await verifyToken(forged, SECRET, NOW)).toBeNull()
  })

  it('rejects a malformed token', async () => {
    expect(await verifyToken('not-a-token', SECRET, NOW)).toBeNull()
    expect(await verifyToken('', SECRET, NOW)).toBeNull()
    expect(await verifyToken('a.b.c', SECRET, NOW)).toBeNull()
  })
})
