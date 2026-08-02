/**
 * Lemon Squeezy webhooks: the fast path for subscription state.
 *
 * Treated as an optimisation rather than the source of truth — a delivery can
 * be lost for good, so src/lib/billing/reconcile.ts repairs whatever this
 * misses. What must never happen is a *forged* event, so the signature is
 * verified over raw bytes before anything is parsed.
 *
 * Two shapes of hostile input are handled here beyond forgery, because the
 * endpoint is unauthenticated until the HMAC clears and the checkout URL is
 * public:
 *
 * - an oversized body, which is why the read is bounded rather than
 *   `request.text()`;
 * - a buyer-chosen `user_email`, which is why email is a last-resort binding
 *   that may never take over a row that already holds a subscription.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { requireDb, type WorkerEnv } from '../apiRoutes'
import { isProAt, type BillingRow } from './entitlement'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

/**
 * Comfortably above a real Lemon Squeezy subscription payload (a few KB) and
 * far below anything that costs a measurable slice of the 10 ms CPU budget.
 */
export const MAX_WEBHOOK_BYTES = 64 * 1024

/**
 * The body, or null if it exceeds `limit`.
 *
 * Read as a bounded stream rather than `request.text()`. The signature is not
 * known good at this point — `X-Signature: 00` is valid hex and survives
 * `hexToBytes` — so an unauthenticated caller must not be able to make us
 * decode, or HMAC, an arbitrarily large body. `Content-Length` is only an
 * early-out; the stream cut-off is what actually bounds the work, since a
 * chunked request has no declared length to trust.
 */
async function readBounded(request: Request, limit: number): Promise<string | null> {
  if (Number(request.headers.get('Content-Length')) > limit) return null

  const reader = request.body?.getReader()
  if (!reader) return ''

  const buffer = new Uint8Array(limit)
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (size + value.byteLength > limit) {
      await reader.cancel()
      return null
    }
    buffer.set(value, size)
    size += value.byteLength
  }
  return decoder.decode(buffer.subarray(0, size))
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

export interface SubscriptionAttributes {
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
 *
 * `current` is the *target user's* row, not "the row holding this subscription
 * id" — see `resolveTarget` for why the difference matters.
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

/** The `users` columns the webhook needs before it is allowed to write. */
interface TargetRow extends BillingRow {
  id: string
  ls_subscription_id: string | null
  ls_updated_at: number | null
}

// `id` is the primary key and `email` is indexed by migration 0002 — D1 bills
// rows scanned, so both lookups touch one row (or the handful sharing an
// address) rather than the table.
const TARGET_COLUMNS =
  'id, ls_subscription_id, ls_status, ls_ends_at, ls_past_due_since, ls_updated_at'

/** Which identifier found the row. Email is buyer-supplied; `user_id` is ours. */
export type MatchedBy = 'user_id' | 'email'

interface Target {
  row: TargetRow
  by: MatchedBy
}

/**
 * `email` is NOT unique — deleting and recreating a Google account leaves two
 * rows with the same address — so an ambiguous match is refused rather than
 * guessed. Picking "the first one" would both bill the wrong user and, because
 * `ls_subscription_id` is UNIQUE, risk a constraint failure on the write.
 */
function pickByEmail(rows: TargetRow[], subscriptionId: string): TargetRow | null {
  const exact = rows.find((row) => row.ls_subscription_id === subscriptionId)
  if (exact) return exact
  if (rows.length === 1) return rows[0]
  return null
}

/**
 * The user this event is about.
 *
 * Resolved *before* anything is compared, because the replay guard has to run
 * against the row we are about to overwrite. Keying it on the incoming
 * subscription id instead — as this handler used to — means an event for a
 * subscription nobody holds finds no row, skips the guard entirely, and applies
 * unconditionally.
 *
 * `user_id` rides in checkout custom data and should always be present; email
 * is the fallback for the case that should not happen.
 */
async function resolveTarget(
  db: D1Database,
  subscriptionId: string,
  userId: string | null,
  email: string | null,
): Promise<Target | null> {
  if (userId) {
    const row = await db
      .prepare(`SELECT ${TARGET_COLUMNS} FROM users WHERE id = ?`)
      .bind(userId)
      .first<TargetRow>()
    return row ? { row, by: 'user_id' } : null
  }

  if (!email) return null
  const found = await db
    .prepare(`SELECT ${TARGET_COLUMNS} FROM users WHERE email = ?`)
    .bind(email)
    .all<TargetRow>()
  const row = pickByEmail(found.results ?? [], subscriptionId)
  return row ? { row, by: 'email' } : null
}

/**
 * Whether this event may write over the row it resolved to.
 *
 * The row already holding this exact subscription, or holding none, is always
 * fair game. Beyond that:
 *
 * - **Matched by email.** Never. The checkout URL is public and takes
 *   `?checkout[email]=`, so anyone can buy a $3 subscription in a victim's
 *   name; letting that seize a row would orphan the victim's real subscription
 *   and point their "Manage billing" button at the attacker's portal.
 * - **Matched by our own `user_id`.** Only if what they hold is already dead.
 *   Someone who cancels monthly A and buys annual B still gets A's
 *   `subscription_expired` weeks later, with a newer `updated_at` than B — that
 *   event must not take Pro away from the annual subscriber it keeps billing.
 */
export function mayApply(
  row: BillingRow & { ls_subscription_id: string | null },
  subscriptionId: string,
  by: MatchedBy,
  now: number,
): boolean {
  const stored = row.ls_subscription_id
  if (!stored || stored === subscriptionId) return true
  if (by === 'email') return false
  return !isProAt(row, now)
}

/**
 * `ls_subscription_id` is UNIQUE, so a write can fail for a reason no retry
 * will ever clear. Everything else — a timeout, a wedged connection — is worth
 * another delivery.
 */
function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown } | null)?.cause
  return /UNIQUE constraint failed/i.test(`${String(error)} ${String(cause ?? '')}`)
}

/**
 * Lemon Squeezy retries any non-2xx, so every "we are not acting on this" exit
 * has to be a 200 — there is nothing to retry into.
 */
function ok(): Response {
  return new Response('ok', { status: 200 })
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

  // Bounded read first, then the HMAC, then the parse. Nothing above the
  // signature check may cost more than a fixed amount of CPU, because nothing
  // above it is authenticated.
  const raw = await readBounded(request, MAX_WEBHOOK_BYTES)
  if (raw === null) return new Response('too large', { status: 413 })

  const valid = await verifyWebhookSignature(raw, request.headers.get('X-Signature'), secret)
  if (!valid) return new Response('bad signature', { status: 401 })

  let payload: {
    meta?: { event_name?: string; custom_data?: { user_id?: string } }
    data?: { type?: string; id?: string; attributes?: SubscriptionAttributes }
  }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('bad body', { status: 400 })
  }

  // `data.type` is the authoritative discriminator, not `meta.event_name`.
  // `subscription_payment_success` arrives seconds after `subscription_created`
  // carrying `subscription-invoices`, whose `data.id` is the *invoice* id and
  // whose status is `paid`. Applied, it writes an invoice id into
  // `ls_subscription_id` and a status `isProAt` reads as not-Pro, so a customer
  // who just paid loses Pro and reconcile then 404s on that id forever.
  if (payload.data?.type !== 'subscriptions') return ok()

  const subscriptionId = payload.data.id ?? null
  if (!subscriptionId) return ok()

  const attributes = payload.data.attributes ?? {}
  const customData = payload.meta?.custom_data ?? null

  const target = await resolveTarget(
    db,
    subscriptionId,
    customData?.user_id ?? null,
    attributes.user_email ?? null,
  )
  if (!target) return ok()

  const now = Date.now()
  if (!mayApply(target.row, subscriptionId, target.by, now)) return ok()

  const patch = patchFromSubscription(subscriptionId, attributes, customData, target.row, now)
  if (!patch) return ok()

  try {
    // Keyed on the primary key, never on `email`: one row, always the one the
    // guard above just cleared.
    await db
      .prepare(
        `UPDATE users SET
           ls_subscription_id = ?, ls_status = ?, ls_variant = ?,
           ls_renews_at = ?, ls_ends_at = ?, ls_past_due_since = ?, ls_updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        patch.ls_subscription_id,
        patch.ls_status,
        patch.ls_variant,
        patch.ls_renews_at,
        patch.ls_ends_at,
        patch.ls_past_due_since,
        patch.ls_updated_at,
        target.row.id,
      )
      .run()
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Another row already holds this subscription. Retrying cannot fix it, and
      // a non-2xx here would stall every later event behind it.
      console.error('billing webhook: subscription already bound elsewhere', subscriptionId)
      return ok()
    }
    return new Response('retry', { status: 500 })
  }

  return ok()
}
