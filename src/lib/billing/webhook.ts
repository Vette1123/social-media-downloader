/**
 * Lemon Squeezy webhooks: the fast path for subscription state.
 *
 * Treated as an optimisation rather than the source of truth — a delivery can
 * be lost for good, so src/lib/billing/reconcile.ts repairs whatever this
 * misses. What must never happen is a *forged* event, so the signature is
 * verified over raw bytes before anything is parsed.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'

const encoder = new TextEncoder()

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    bytes[i] = byte
  }
  return bytes
}

/**
 * HMAC-SHA256 over the raw body, compared with `crypto.subtle.verify`, which is
 * constant-time. Never skipped in any environment: an unverified webhook
 * endpoint lets anyone grant themselves Pro.
 */
export async function verifyWebhookSignature(
  raw: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false
  const bytes = hexToBytes(signature.trim())
  if (!bytes) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(raw))
}

export interface SubscriptionPatch {
  userId: string | null
  email: string | null
  ls_subscription_id: string
  ls_status: string
  ls_variant: string
  ls_renews_at: number | null
  ls_ends_at: number | null
  ls_past_due_since: number | null
  ls_updated_at: number
}

interface SubscriptionAttributes {
  status?: string
  variant_name?: string
  renews_at?: string | null
  ends_at?: string | null
  user_email?: string | null
  updated_at?: string
}

interface CurrentRow {
  ls_updated_at: number | null
  ls_past_due_since: number | null
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/** Anything not obviously annual is monthly — the two variants are ours. */
function variantOf(name: string | undefined): string {
  return /year|annual/i.test(name ?? '') ? 'annual' : 'monthly'
}

/**
 * When the grace clock starts.
 *
 * Stamped the first time `past_due` is seen and preserved on every later
 * `past_due` event, so a subscription that emits several failed-payment
 * webhooks does not keep resetting its own 14-day window. Cleared the moment
 * the status is anything else.
 */
function pastDueSince(status: string, current: CurrentRow | null, now: number): number | null {
  if (status !== 'past_due') return null
  return current?.ls_past_due_since ?? now
}

/**
 * The pure event → row patch. Returns null for an event that is stale (Lemon
 * Squeezy retries on any non-2xx, so handlers must be idempotent) or unusable.
 */
export function patchFromSubscription(
  subscriptionId: string | null,
  attributes: SubscriptionAttributes,
  customData: { user_id?: string } | null,
  current: CurrentRow | null,
  now: number,
): SubscriptionPatch | null {
  if (!subscriptionId || !attributes.status) return null

  const updatedAt = parseDate(attributes.updated_at) ?? now
  if (current?.ls_updated_at != null && updatedAt <= current.ls_updated_at) return null

  return {
    userId: customData?.user_id ?? null,
    email: attributes.user_email ?? null,
    ls_subscription_id: subscriptionId,
    ls_status: attributes.status,
    ls_variant: variantOf(attributes.variant_name),
    ls_renews_at: parseDate(attributes.renews_at),
    ls_ends_at: parseDate(attributes.ends_at),
    ls_past_due_since: pastDueSince(attributes.status, current, now),
    ls_updated_at: updatedAt,
  }
}

/** POST /api/billing/webhook */
export async function handleWebhook(
  request: Request,
  _ctx?: unknown,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()
  if (!secret) return new Response('not configured', { status: 503 })

  // Raw text first, parsed only after the signature holds — parsing before
  // verifying would let an unauthenticated caller spend our CPU on an
  // arbitrarily large payload.
  const raw = await request.text()
  const valid = await verifyWebhookSignature(raw, request.headers.get('X-Signature'), secret)
  if (!valid) return new Response('bad signature', { status: 401 })

  let payload: {
    meta?: { custom_data?: { user_id?: string } }
    data?: { id?: string; attributes?: SubscriptionAttributes }
  }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('bad body', { status: 400 })
  }

  const subscriptionId = payload.data?.id ?? null
  const attributes = payload.data?.attributes ?? {}
  const customData = payload.meta?.custom_data ?? null

  // The row we may already hold for this subscription, for the replay guard and
  // the past_due clock.
  const current = subscriptionId
    ? await db
        .prepare(
          'SELECT ls_updated_at, ls_past_due_since FROM users WHERE ls_subscription_id = ?',
        )
        .bind(subscriptionId)
        .first<CurrentRow>()
    : null

  const patch = patchFromSubscription(subscriptionId, attributes, customData, current, Date.now())
  // 200 on a stale or unusable event: Lemon Squeezy retries non-2xx, and there
  // is nothing to retry into.
  if (!patch) return new Response('ok', { status: 200 })

  // user_id rides in checkout custom data and should always be present, since
  // checkout requires signing in first. Email is the fallback for the case that
  // should not happen.
  const target = patch.userId
    ? { column: 'id', value: patch.userId }
    : { column: 'email', value: patch.email }
  if (!target.value) return new Response('ok', { status: 200 })

  await db
    .prepare(
      `UPDATE users SET
         ls_subscription_id = ?, ls_status = ?, ls_variant = ?,
         ls_renews_at = ?, ls_ends_at = ?, ls_past_due_since = ?, ls_updated_at = ?
       WHERE ${target.column} = ?`,
    )
    .bind(
      patch.ls_subscription_id,
      patch.ls_status,
      patch.ls_variant,
      patch.ls_renews_at,
      patch.ls_ends_at,
      patch.ls_past_due_since,
      patch.ls_updated_at,
      target.value,
    )
    .run()

  return new Response('ok', { status: 200 })
}
