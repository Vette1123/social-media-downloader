import { describe, expect, it } from 'vitest'
import { signToken, verifyToken, TOKEN_TTL_MS } from './licenseToken'

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

  it('rejects a non-base64url signature segment without throwing', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const [body] = token.split('.')
    await expect(
      verifyToken(`${body}.***not-base64***`, SECRET, NOW),
    ).resolves.toBeNull()
  })

  it('rejects a non-base64url body segment without throwing', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const [, signature] = token.split('.')
    await expect(
      verifyToken(`***not-base64***.${signature}`, SECRET, NOW),
    ).resolves.toBeNull()
  })

  it('rejects a truncated signature', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const [body, signature] = token.split('.')
    expect(
      await verifyToken(`${body}.${signature.slice(0, 8)}`, SECRET, NOW),
    ).toBeNull()
  })

  it('rejects an empty signature segment ("body.")', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const [body] = token.split('.')
    expect(await verifyToken(`${body}.`, SECRET, NOW)).toBeNull()
  })

  it('rejects an empty body segment (".sig")', async () => {
    const token = await signToken({ k: 'abc123', exp: NOW + 1000 }, SECRET)
    const [, signature] = token.split('.')
    expect(await verifyToken(`.${signature}`, SECRET, NOW)).toBeNull()
  })

  it('rejects a non-string token without throwing', async () => {
    // The absent case in a Worker: request.headers.get(...) is `string | null`.
    await expect(verifyToken(null, SECRET, NOW)).resolves.toBeNull()
    await expect(verifyToken(undefined, SECRET, NOW)).resolves.toBeNull()
    await expect(verifyToken(1234, SECRET, NOW)).resolves.toBeNull()
    await expect(verifyToken({ token: 'x' }, SECRET, NOW)).resolves.toBeNull()
  })

  it('rejects an oversized token without doing the HMAC work', async () => {
    const oversized = `${'a'.repeat(600)}.${'b'.repeat(600)}`
    expect(await verifyToken(oversized, SECRET, NOW)).toBeNull()
  })

  it('accepts a token right at the TTL boundary and rejects one past it', async () => {
    const atBoundary = await signToken({ k: 'abc123', exp: NOW + TOKEN_TTL_MS }, SECRET)
    expect(await verifyToken(atBoundary, SECRET, NOW)).toEqual({
      k: 'abc123',
      exp: NOW + TOKEN_TTL_MS,
    })

    const pastBoundary = await signToken({ k: 'abc123', exp: NOW + TOKEN_TTL_MS + 1 }, SECRET)
    expect(await verifyToken(pastBoundary, SECRET, NOW)).toBeNull()
  })
})
