import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { SUPPORT_LIFETIME, SUPPORT_MEMBERSHIP } from '../../config/support'
import {
  BMC_LEVELS,
  SIGNATURE_HEADER,
  bmcWebhook,
  claimSupporterGrants,
  handleBmcWebhook,
  pickEmail,
  pickLevel,
  resolveLevel,
  type BmcConfig,
} from './bmc'

const SECRET = 'bmc-signing-secret'
/** Mirrors what `handleBmcWebhook` passes in production, extras included. */
const CONFIG: BmcConfig = {
  secret: SECRET,
  levels: BMC_LEVELS,
  grantEvents: ['extra_purchase.created'],
}

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * A stand-in for D1 holding two tables in memory.
 *
 * Hand-rolled rather than mocked call-by-call: the handler's whole job is the
 * state left behind across several statements — insert, then read back, then
 * update a second table — and a mock that returns canned rows asserts the
 * statements were written, not that the supporter ends up entitled.
 */
interface UserRow {
  id: string
  email: string
  grants: string | null
}
interface SupporterRow {
  email: string
  grants: string
  level: string | null
  lifetime: number
  source: string
  event_id: number | null
  updated_at: number
}

function fakeDb(users: UserRow[] = [], supporters: SupporterRow[] = []) {
  const state = { users, supporters }

  function run(sql: string, args: unknown[]) {
    const text = sql.replace(/\s+/g, ' ').trim()

    if (text.startsWith('SELECT id, grants FROM users WHERE email')) {
      return { results: state.users.filter((row) => row.email === args[0]) }
    }
    if (text.startsWith('SELECT grants FROM users WHERE id')) {
      return { first: state.users.find((row) => row.id === args[0]) ?? null }
    }
    if (text.startsWith('UPDATE users SET grants')) {
      const user = state.users.find((row) => row.id === args[1])
      if (user) user.grants = args[0] as string | null
      return {}
    }
    if (text.startsWith('SELECT grants FROM supporters WHERE email')) {
      return { first: state.supporters.find((row) => row.email === args[0]) ?? null }
    }
    if (text.startsWith('SELECT grants, lifetime, event_id, updated_at FROM supporters')) {
      return { first: state.supporters.find((row) => row.email === args[0]) ?? null }
    }
    if (text.startsWith('DELETE FROM supporters')) {
      state.supporters = state.supporters.filter((row) => row.email !== args[0])
      return {}
    }
    if (text.startsWith('INSERT INTO supporters')) {
      const [email, grants, level, lifetime, source, eventId, updatedAt] = args as [
        string,
        string,
        string | null,
        number,
        string,
        number | null,
        number,
      ]
      const existing = state.supporters.find((row) => row.email === email)
      const next: SupporterRow = {
        email,
        grants,
        level,
        lifetime: Math.max(existing?.lifetime ?? 0, lifetime),
        source,
        event_id: eventId,
        updated_at: updatedAt,
      }
      if (existing) Object.assign(existing, next)
      else state.supporters.push(next)
      return {}
    }
    throw new Error(`unexpected statement: ${text}`)
  }

  const db = {
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => ({
          first: async () => (run(sql, args) as { first?: unknown }).first ?? null,
          all: async () => ({ results: (run(sql, args) as { results?: unknown[] }).results ?? [] }),
          run: async () => run(sql, args),
        }),
      }
    },
  }

  return { db: db as unknown as D1Database, state }
}

interface EventOptions {
  type: string
  data: Record<string, unknown>
  eventId?: number
  created?: number
}

async function post(
  options: EventOptions,
  db: D1Database,
  config: BmcConfig = CONFIG,
  secret = SECRET,
): Promise<Response> {
  const body = JSON.stringify({
    event_id: options.eventId ?? 1,
    type: options.type,
    live_mode: true,
    created: options.created ?? 1_800_000_000,
    attempt: 1,
    data: options.data,
  })
  const request = new Request('https://example.com/api/billing/bmc', {
    method: 'POST',
    headers: { [SIGNATURE_HEADER]: await sign(body, secret) },
    body,
  })
  return bmcWebhook(request, db, config)
}

describe('pickEmail', () => {
  it('reads the flat field', () => {
    expect(pickEmail({ supporter_email: 'A@Example.com ' })).toBe('a@example.com')
  })

  it('reads a nested supporter object', () => {
    expect(pickEmail({ supporter: { email: 'b@example.com' } })).toBe('b@example.com')
  })

  it('is null when no candidate key carries an address', () => {
    expect(pickEmail({ supporter_name: 'Nobody' })).toBeNull()
  })

  it('rejects a value that is not an address rather than storing it', () => {
    expect(pickEmail({ email: 'Display Name' })).toBeNull()
  })
})

describe('pickLevel', () => {
  it('reads the flat field', () => {
    expect(pickLevel({ level_name: SUPPORT_LIFETIME })).toBe(SUPPORT_LIFETIME)
  })

  it('reads a nested level object', () => {
    expect(pickLevel({ membership_level: { name: SUPPORT_MEMBERSHIP } })).toBe(
      SUPPORT_MEMBERSHIP,
    )
  })

  /** An extras purchase is a different shelf and, probably, a different key. */
  it('reads an extras purchase by name', () => {
    expect(pickLevel({ extra_name: SUPPORT_LIFETIME })).toBe(SUPPORT_LIFETIME)
    expect(pickLevel({ product: { title: SUPPORT_LIFETIME } })).toBe(SUPPORT_LIFETIME)
  })

  /**
   * `data.name` on a donation is the supporter's own name. Reading it as a
   * level name would look up a level nobody configured.
   */
  it('ignores a bare name field', () => {
    expect(pickLevel({ name: 'Mohamed' })).toBeNull()
  })
})

describe('resolveLevel', () => {
  it('matches a configured level regardless of case and spacing', () => {
    expect(resolveLevel(CONFIG, '  DOWNLOADER   LIFETIME ')).toEqual({
      grant: 'pro',
      lifetime: true,
    })
  })

  /**
   * The separator is an em dash in the config and typed by hand in the
   * dashboard. Every one of these is the same offer, and a mismatch here would
   * drop a paying supporter with only a log line to show for it.
   */
  it.each([
    'Downloader — Supporter',
    'Downloader - Supporter',
    'Downloader – Supporter',
    'downloader supporter',
    'Downloader_Supporter',
  ])('reads %s as the same offer', (name) => {
    expect(resolveLevel(CONFIG, name)).toEqual({ grant: 'pro' })
  })

  /** The rule that keeps one membership from unlocking every project. */
  it('grants nothing for a level belonging to another project', () => {
    expect(resolveLevel(CONFIG, 'Notes Supporter')).toBeNull()
  })

  it('grants nothing when the payload carried no level at all', () => {
    expect(resolveLevel(CONFIG, null)).toBeNull()
  })

  it('honours an explicit fallback, for an account serving one project', () => {
    expect(resolveLevel({ ...CONFIG, fallback: { grant: 'pro' } }, 'Gold')).toEqual({
      grant: 'pro',
    })
  })
})

describe('bmcWebhook', () => {
  it('rejects a body signed with the wrong secret', async () => {
    const { db, state } = fakeDb()
    const response = await post(
      { type: 'membership.started', data: { supporter_email: 'a@example.com' } },
      db,
      CONFIG,
      'not-the-secret',
    )
    expect(response.status).toBe(401)
    expect(state.supporters).toHaveLength(0)
  })

  it('records a supporter who has no account yet', async () => {
    const { db, state } = fakeDb()
    const response = await post(
      {
        type: 'membership.started',
        data: { supporter_email: 'new@example.com', level_name: SUPPORT_MEMBERSHIP },
      },
      db,
    )
    expect(response.status).toBe(200)
    expect(state.supporters[0]).toMatchObject({
      email: 'new@example.com',
      grants: 'pro',
      lifetime: 0,
    })
  })

  it('entitles an account that already exists', async () => {
    const { db, state } = fakeDb([{ id: 'u1', email: 'known@example.com', grants: null }])
    await post(
      {
        type: 'membership.started',
        data: { supporter: { email: 'Known@example.com' }, level: { name: SUPPORT_MEMBERSHIP } },
      },
      db,
    )
    expect(state.users[0].grants).toBe('pro')
  })

  it('keeps every other grant when it adds one', async () => {
    const { db, state } = fakeDb([{ id: 'u1', email: 'known@example.com', grants: 'ig' }])
    await post(
      {
        type: 'membership.started',
        data: { supporter_email: 'known@example.com', level_name: SUPPORT_MEMBERSHIP },
      },
      db,
    )
    expect(state.users[0].grants).toBe('ig,pro')
  })

  /**
   * The whole point of naming the levels per project. One account sells several
   * projects' memberships and every endpoint sees every event; paying for one
   * must not unlock the rest.
   */
  it('ignores a membership for a level belonging to another project', async () => {
    const { db, state } = fakeDb([{ id: 'u1', email: 'known@example.com', grants: null }])
    const response = await post(
      {
        type: 'membership.started',
        data: { supporter_email: 'known@example.com', level_name: 'Notes Supporter' },
      },
      db,
    )
    expect(response.status).toBe(200)
    expect(state.supporters).toHaveLength(0)
    expect(state.users[0].grants).toBeNull()
  })

  it('ignores an event whose level could not be read at all', async () => {
    const { db, state } = fakeDb()
    await post(
      { type: 'membership.started', data: { supporter_email: 'quiet@example.com' } },
      db,
    )
    expect(state.supporters).toHaveLength(0)
  })

  it('leaves this project alone when a sibling project level is cancelled', async () => {
    const { db, state } = fakeDb(
      [{ id: 'u1', email: 'known@example.com', grants: 'pro' }],
      [
        {
          email: 'known@example.com',
          grants: 'pro',
          level: SUPPORT_MEMBERSHIP,
          lifetime: 0,
          source: 'bmc',
          event_id: 1,
          updated_at: 1_800_000_000_000,
        },
      ],
    )
    await post(
      {
        type: 'membership.cancelled',
        data: { supporter_email: 'known@example.com', level_name: 'Notes Supporter' },
        eventId: 2,
        created: 1_800_000_100,
      },
      db,
    )
    expect(state.supporters).toHaveLength(1)
    expect(state.users[0].grants).toBe('pro')
  })

  it('revokes on cancellation, leaving unrelated grants alone', async () => {
    const { db, state } = fakeDb(
      [{ id: 'u1', email: 'known@example.com', grants: 'ig,pro' }],
      [
        {
          email: 'known@example.com',
          grants: 'pro',
          level: SUPPORT_MEMBERSHIP,
          lifetime: 0,
          source: 'bmc',
          event_id: 1,
          updated_at: 1_800_000_000_000,
        },
      ],
    )
    await post(
      {
        type: 'membership.cancelled',
        data: { supporter_email: 'known@example.com' },
        eventId: 2,
        created: 1_800_000_100,
      },
      db,
    )
    expect(state.supporters).toHaveLength(0)
    expect(state.users[0].grants).toBe('ig')
  })

  /** The one rule a one-time purchase depends on. */
  it('ignores a cancellation for a lifetime level', async () => {
    const { db, state } = fakeDb(
      [{ id: 'u1', email: 'known@example.com', grants: 'pro' }],
      [
        {
          email: 'known@example.com',
          grants: 'pro',
          level: SUPPORT_LIFETIME,
          lifetime: 1,
          source: 'bmc',
          event_id: 1,
          updated_at: 1_800_000_000_000,
        },
      ],
    )
    await post(
      {
        type: 'membership.cancelled',
        data: { supporter_email: 'known@example.com' },
        eventId: 2,
        created: 1_800_000_100,
      },
      db,
    )
    expect(state.supporters).toHaveLength(1)
    expect(state.users[0].grants).toBe('pro')
  })

  it('does not let a later monthly downgrade a lifetime member', async () => {
    const { db, state } = fakeDb()
    await post(
      {
        type: 'extra_purchase.created',
        data: { supporter_email: 'life@example.com', extra_name: SUPPORT_LIFETIME },
      },
      db,
    )
    await post(
      {
        type: 'membership.started',
        data: { supporter_email: 'life@example.com', level_name: SUPPORT_MEMBERSHIP },
        eventId: 2,
        created: 1_800_000_100,
      },
      db,
    )
    expect(state.supporters[0].lifetime).toBe(1)
  })

  /**
   * The provider retries anything that is not a 2xx, so a redelivered cancel
   * must not be able to undo a membership that started after it.
   */
  it('ignores a redelivery of the same event', async () => {
    const { db, state } = fakeDb([{ id: 'u1', email: 'known@example.com', grants: null }])
    const event = {
      type: 'membership.started' as const,
      data: { supporter_email: 'known@example.com', level_name: SUPPORT_MEMBERSHIP },
      eventId: 7,
    }
    await post(event, db)
    state.users[0].grants = 'ig'
    await post(event, db)
    expect(state.users[0].grants).toBe('ig')
  })

  it('ignores an event older than the one already applied', async () => {
    const { db, state } = fakeDb(
      [],
      [
        {
          email: 'known@example.com',
          grants: 'pro',
          level: SUPPORT_MEMBERSHIP,
          lifetime: 0,
          source: 'bmc',
          event_id: 5,
          updated_at: 1_800_000_500_000,
        },
      ],
    )
    await post(
      {
        type: 'membership.cancelled',
        data: { supporter_email: 'known@example.com' },
        eventId: 4,
        created: 1_800_000_400,
      },
      db,
    )
    expect(state.supporters).toHaveLength(1)
  })

  it('ignores an event type it was not configured for', async () => {
    const { db, state } = fakeDb()
    const response = await post(
      { type: 'donation.created', data: { supporter_email: 'tip@example.com' } },
      db,
    )
    expect(response.status).toBe(200)
    expect(state.supporters).toHaveLength(0)
  })

  /** Lifetime lives on the Extras shelf, so this is the only way it arrives. */
  it('grants an unrevocable lifetime from an extras purchase', async () => {
    const { db, state } = fakeDb([{ id: 'u1', email: 'tip@example.com', grants: null }])
    await post(
      {
        type: 'extra_purchase.created',
        data: { supporter_email: 'tip@example.com', extra: { name: SUPPORT_LIFETIME } },
      },
      db,
    )
    expect(state.supporters[0]).toMatchObject({ grants: 'pro', lifetime: 1 })
    expect(state.users[0].grants).toBe('pro')
  })

  /**
   * The reason `extra_purchase.created` was left out of the shared defaults:
   * it fires for every shop item on the account. Turning it on is only safe
   * because the name still has to match.
   */
  it('ignores an extras purchase that is not ours', async () => {
    const { db, state } = fakeDb()
    const response = await post(
      {
        type: 'extra_purchase.created',
        data: { supporter_email: 'tip@example.com', extra_name: 'Sticker pack' },
      },
      db,
    )
    expect(response.status).toBe(200)
    expect(state.supporters).toHaveLength(0)
  })

  it('does not record anything when no email can be read', async () => {
    const { db, state } = fakeDb()
    const response = await post(
      { type: 'membership.started', data: { supporter_name: 'Anonymous' } },
      db,
    )
    expect(response.status).toBe(200)
    expect(state.supporters).toHaveLength(0)
  })
})

describe('claimSupporterGrants', () => {
  it('gives a new account what was already paid for', async () => {
    const { db, state } = fakeDb(
      [{ id: 'u1', email: 'paid@example.com', grants: null }],
      [
        {
          email: 'paid@example.com',
          grants: 'pro',
          level: SUPPORT_LIFETIME,
          lifetime: 1,
          source: 'bmc',
          event_id: 1,
          updated_at: 1,
        },
      ],
    )
    await claimSupporterGrants(db, 'u1', 'Paid@example.com')
    expect(state.users[0].grants).toBe('pro')
  })

  it('does nothing for someone who never supported the project', async () => {
    const { db, state } = fakeDb([{ id: 'u1', email: 'nobody@example.com', grants: null }])
    await claimSupporterGrants(db, 'u1', 'nobody@example.com')
    expect(state.users[0].grants).toBeNull()
  })

  it('is idempotent and preserves other grants', async () => {
    const { db, state } = fakeDb(
      [{ id: 'u1', email: 'paid@example.com', grants: 'ig,pro' }],
      [
        {
          email: 'paid@example.com',
          grants: 'pro',
          level: SUPPORT_MEMBERSHIP,
          lifetime: 0,
          source: 'bmc',
          event_id: 1,
          updated_at: 1,
        },
      ],
    )
    await claimSupporterGrants(db, 'u1', 'paid@example.com')
    expect(state.users[0].grants).toBe('ig,pro')
  })
})

describe('handleBmcWebhook', () => {
  const previous = process.env.BMC_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.BMC_WEBHOOK_SECRET = SECRET
  })
  afterEach(() => {
    process.env.BMC_WEBHOOK_SECRET = previous
  })

  it('answers 503 where there is no database binding', async () => {
    const response = await handleBmcWebhook(
      new Request('https://example.com/api/billing/bmc', { method: 'POST', body: '{}' }),
    )
    expect(response.status).toBe(503)
  })

  it('answers 503 rather than accepting anything when the secret is unset', async () => {
    delete process.env.BMC_WEBHOOK_SECRET
    const { db } = fakeDb()
    const response = await handleBmcWebhook(
      new Request('https://example.com/api/billing/bmc', { method: 'POST', body: '{}' }),
      undefined,
      { DB: db },
    )
    expect(response.status).toBe(503)
  })
})
