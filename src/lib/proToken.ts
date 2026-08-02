/**
 * A minimal signed token, used so that a Pro request can be trusted by the
 * Worker without a database read on every resolve.
 *
 * Deliberately not a JWT: no library, no algorithm negotiation, no header to
 * get wrong. Payload plus HMAC-SHA256, base64url, verified with WebCrypto —
 * which is available in workerd, in Node 18+, and in the browser, so the same
 * code runs everywhere this project deploys.
 *
 * Verification is a single HMAC over ~60 bytes: microseconds, which matters
 * because it runs inside the 10 ms per-request CPU budget on the free plan.
 */

export interface TokenPayload {
  /** The user's id. Opaque to the client; only ever compared, never displayed. */
  u: string
  /** Absolute expiry, epoch milliseconds. */
  exp: number
  /**
   * Whether this user is Pro. Carrying the entitlement in the token is what
   * lets /api/download answer without a database read — the cost is that a
   * change in entitlement takes up to one TTL to be felt.
   */
  p: boolean
}

/**
 * Fifteen minutes: long enough that an active user refreshes at most four times
 * an hour, short enough to bound how stale an entitlement can get.
 *
 * "Bound", not "revoke". Nothing re-checks an issued token against the
 * database, so signing out everywhere, deleting the account, or losing a
 * subscription all leave a window of up to one TTL in which an already-minted
 * token still buys Pro. That is the deliberate price of keeping /api/download
 * free of a D1 read; the alternative does not fit the 10 ms CPU budget.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000

const encoder = new TextEncoder()

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signToken(
  payload: TokenPayload,
  secret: string,
): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`
}

// Comfortably above a real token (139 chars measured: a base64url-encoded
// `{"u":"<opaque user id>","exp":<13-digit ms epoch>,"p":true}` body plus a
// 43-char signature). Rejecting oversized input before any decode/HMAC work
// keeps the hot path bounded regardless of what fronts the Worker.
const MAX_TOKEN_LENGTH = 512

export async function verifyToken(
  token: unknown,
  secret: string,
  now: number,
): Promise<TokenPayload | null> {
  if (typeof token !== 'string') return null
  if (token.length > MAX_TOKEN_LENGTH) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts
  if (!body || !signature) return null

  try {
    const key = await hmacKey(secret)
    // crypto.subtle.verify is constant-time, so this is not a comparison the
    // caller could time their way through.
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(body),
    )
    if (!valid) return null

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body)),
    ) as TokenPayload
    if (
      typeof payload?.u !== 'string' ||
      typeof payload?.exp !== 'number' ||
      typeof payload?.p !== 'boolean'
    ) {
      return null
    }
    if (payload.exp <= now) return null
    // Bounds the blast radius of a mis-issued token (arithmetic slip,
    // seconds/milliseconds mixup, compromised admin path): no token is
    // trusted for longer than ACCESS_TOKEN_TTL_MS from the moment it's
    // checked, no matter what `exp` a caller of signToken put in it.
    if (payload.exp - now > ACCESS_TOKEN_TTL_MS) return null
    return payload
  } catch {
    return null
  }
}

/**
 * SHA-256, hex-encoded. Used to hash session cookie values before they are
 * stored, so a leaked database read does not hand anyone a working session.
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
