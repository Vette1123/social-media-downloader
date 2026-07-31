/**
 * A minimal signed token, used so that a Pro request can be trusted by the
 * Worker without a round trip to Lemon Squeezy on every resolve.
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
  /** An opaque hash of the license key. The raw key never enters the token. */
  k: string
  /** Absolute expiry, epoch milliseconds. */
  exp: number
}

/** Tokens live a day; the client re-validates against Lemon Squeezy after that. */
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

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

export async function verifyToken(
  token: string,
  secret: string,
  now: number,
): Promise<TokenPayload | null> {
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
    if (typeof payload?.k !== 'string' || typeof payload?.exp !== 'number') {
      return null
    }
    if (payload.exp <= now) return null
    return payload
  } catch {
    return null
  }
}

/** SHA-256 of the raw key, so the key itself is never stored or transmitted in a token. */
export async function hashKey(licenseKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(licenseKey))
  return base64UrlEncode(new Uint8Array(digest))
}
