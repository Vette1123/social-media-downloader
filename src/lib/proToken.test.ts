import { describe, expect, it } from 'vitest'
import { signToken, verifyToken, ACCESS_TOKEN_TTL_MS } from './proToken'

const SECRET = 'test-secret-value'
const NOW = 1_800_000_000_000

describe('licenseToken', () => {
  it('round-trips a payload', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW + 1000, p: true }, SECRET)
    const payload = await verifyToken(token, SECRET, NOW)
    expect(payload).toEqual({ u: 'user-1', exp: NOW + 1000, p: true })
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW + 1000, p: true }, SECRET)
    expect(await verifyToken(token, 'other-secret', NOW)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW - 1, p: true }, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW + 1000, p: true }, SECRET)
    const [, signature] = token.split('.')
    const forged = `${btoa(JSON.stringify({ u: 'hacked', exp: NOW + 1000, p: true }))}.${signature}`
    expect(await verifyToken(forged, SECRET, NOW)).toBeNull()
  })

  it('rejects a malformed token', async () => {
    expect(await verifyToken('not-a-token', SECRET, NOW)).toBeNull()
    expect(await verifyToken('', SECRET, NOW)).toBeNull()
    expect(await verifyToken('a.b.c', SECRET, NOW)).toBeNull()
  })

  it('rejects a non-base64url signature segment without throwing', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW + 1000, p: true }, SECRET)
    const [body] = token.split('.')
    await expect(
      verifyToken(`${body}.***not-base64***`, SECRET, NOW),
    ).resolves.toBeNull()
  })

  it('rejects a non-base64url body segment without throwing', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW + 1000, p: true }, SECRET)
    const [, signature] = token.split('.')
    await expect(
      verifyToken(`***not-base64***.${signature}`, SECRET, NOW),
    ).resolves.toBeNull()
  })

  it('rejects a truncated signature', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW + 1000, p: true }, SECRET)
    const [body, signature] = token.split('.')
    expect(
      await verifyToken(`${body}.${signature.slice(0, 8)}`, SECRET, NOW),
    ).toBeNull()
  })

  it('rejects an empty signature segment ("body.")', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW + 1000, p: true }, SECRET)
    const [body] = token.split('.')
    expect(await verifyToken(`${body}.`, SECRET, NOW)).toBeNull()
  })

  it('rejects an empty body segment (".sig")', async () => {
    const token = await signToken({ u: 'user-1', exp: NOW + 1000, p: true }, SECRET)
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
    const atBoundary = await signToken(
      { u: 'user-1', exp: NOW + ACCESS_TOKEN_TTL_MS, p: true },
      SECRET,
    )
    expect(await verifyToken(atBoundary, SECRET, NOW)).toEqual({
      u: 'user-1',
      exp: NOW + ACCESS_TOKEN_TTL_MS,
      p: true,
    })

    const pastBoundary = await signToken(
      { u: 'user-1', exp: NOW + ACCESS_TOKEN_TTL_MS + 1, p: true },
      SECRET,
    )
    expect(await verifyToken(pastBoundary, SECRET, NOW)).toBeNull()
  })
})

describe('the pro flag', () => {
  it('round-trips a Pro user', async () => {
    const exp = NOW + 60_000
    const token = await signToken({ u: 'user-1', exp, p: true }, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toEqual({ u: 'user-1', exp, p: true })
  })

  it('round-trips a signed-in free user', async () => {
    const exp = NOW + 60_000
    const token = await signToken({ u: 'user-1', exp, p: false }, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toEqual({ u: 'user-1', exp, p: false })
  })

  it('rejects a payload missing the pro flag', async () => {
    const exp = NOW + 60_000
    const token = await signToken({ u: 'user-1', exp } as never, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toBeNull()
  })

  it('rejects a payload with no user id', async () => {
    const exp = NOW + 60_000
    const token = await signToken({ exp, p: true } as never, SECRET)
    expect(await verifyToken(token, SECRET, NOW)).toBeNull()
  })
})
