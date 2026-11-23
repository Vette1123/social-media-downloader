/**
 * The single client-side entry to POST /api/download.
 *
 * Lifted verbatim out of `DownloaderApp`'s `resolveOne` so the Pro batch queue
 * can run the same pipeline without importing a React component. Nothing here
 * touches hooks, component state, or the DOM — the caller passes everything in.
 *
 * Sibling modules are imported by relative path (not `@/lib/...`) so this file
 * loads in the Vitest node environment, which has no path-alias plugin.
 */

import {
  contentProps,
  trackLinkRejected,
  trackLinkSubmitted,
  trackResolveFailed,
  trackResolveSucceeded,
  type LinkSource,
} from './analytics'
import { errorMessage, failureCode } from './analyticsErrors'
import type { VideoMetadata } from './appReducer'
import { isTransientError, withRetry } from './retry'
import { resolveTikTokInBrowser } from './tikwmClient'
import { detectPlatform, unwrapRedirect } from './validator'

export interface ResolveOptions {
  type?: 'video' | 'audio'
  quality?: 'hd' | 'sd'
  /**
   * `'video'` and `'auto'` are the same thing to the server: `handleDownload`
   * maps anything that is not `'audio'` to mode `'auto'`. Both are accepted so
   * the paste box can keep sending the exact value it always sent while the
   * batch queue uses the plan's `'auto'`.
   */
  format?: 'auto' | 'video' | 'audio'
  /** Task 15: sent as X-Pro-Token so the Worker can prefer the fast resolver. */
  proToken?: string | null
  signal?: AbortSignal
  /** Where the link came from, for the funnel. */
  source?: LinkSource
}

export interface ResolveResult {
  success: boolean
  downloadUrl?: string
  audioUrl?: string
  metadata?: VideoMetadata
  error?: string
}

/**
 * How long the browser's own TikTok attempt runs alone before the server is
 * asked as well. See `resolve`.
 *
 * Zero since 2026-11-19. It was 700 ms, sized for a tikwm that answered in a
 * few hundred ms; measured that day it answered in 2.2–5.6 s on 9 of 9 calls,
 * so the head start never let it win and only added 0.7 s to every paste. An
 * answer tikwm already has (settled before the timer fires) still wins without
 * a server request.
 */
const HEDGE_AFTER_MS = 0

const after = (ms: number) =>
  new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))

/**
 * Resolve one link against the API. Returns the parsed response, or throws on
 * network failure — the caller owns the error copy.
 *
 * Analytics sits here because every surface comes through: the paste box, the
 * batch queue, a re-pick, a retry. No caller can forget to report.
 */
export async function resolve(
  pasted: string,
  opts: ResolveOptions = {},
): Promise<ResolveResult> {
  // Every surface, not just the paste box: the batch queue and a re-pick hand
  // over the link as pasted, and a Google/Facebook wrapper judged as itself is
  // google.com on `generic` (issue #73).
  const url = unwrapRedirect(pasted)
  const platform = detectPlatform(url)
  const format = opts.format ?? 'auto'
  const quality = opts.quality ?? 'hd'
  // Text with no parseable host cannot resolve, and a request to say so costs an
  // extractor run (198 of these in 23 days). Refused here so every caller —
  // paste box, batch, re-pick — gets the same answer.
  if (platform === 'unknown') {
    trackLinkRejected({ platform, reason: 'not_a_url' })
    return { success: false, error: 'That is not a valid URL.' }
  }
  const startedAt = Date.now()
  const elapsed = () => Date.now() - startedAt
  trackLinkSubmitted({
    platform,
    source: opts.source ?? 'typed',
    format,
    quality,
    link: url,
  })
  try {
    const result = await resolveLink(url, opts)
    if (result.success) {
      trackResolveSucceeded(contentProps(result.metadata, url), {
        duration_ms: elapsed(),
        format,
        quality,
      })
    } else {
      trackResolveFailed({
        platform,
        message: result.error,
        duration_ms: elapsed(),
        format,
        link: url,
      })
    }
    return result
  } catch (error) {
    // A cancelled paste is a decision, not a failure.
    if (!opts.signal?.aborted) {
      trackResolveFailed({
        platform,
        message: errorMessage(error),
        duration_ms: elapsed(),
        format,
        link: url,
      })
    }
    throw error
  }
}

async function resolveLink(
  url: string,
  opts: ResolveOptions,
): Promise<ResolveResult> {
  const wantType = opts.type ?? 'video'
  const wantQuality = opts.quality ?? 'hd'
  const wantFormat = opts.format ?? 'auto'

  const fromServer = (signal?: AbortSignal) =>
    resolveOnServer(
      url,
      wantType,
      wantQuality,
      wantFormat,
      signal ? { ...opts, signal } : opts,
    )

  // TikTok resolves ~25x faster straight from the browser, and costs us nothing
  // at all when it works — see lib/tikwmClient.
  //
  // It is HEDGED rather than awaited outright. tikwm queues its callers under
  // load (measured 2026-08-14: 13.2s for a request it reports spending 2.1s on),
  // and waiting for it to time out before asking the server made a paste take
  // the timeout plus a full server resolve. So the server is asked too once the
  // browser attempt has had HEDGE_AFTER_MS to itself, and whichever answers
  // first is the answer. In the common case tikwm is quick, wins, and no server
  // request is ever made.
  if (wantFormat !== 'audio' && detectPlatform(url) === 'tiktok') {
    // Widened to the shared result type on purpose: tikwm's own type narrows
    // `success` to `true`, and the two resolvers have to be interchangeable
    // below for either to win the race.
    const local: Promise<ResolveResult | null> = resolveTikTokInBrowser(
      url,
      wantQuality,
    ).catch(() => null)

    // Answered inside the hedge window: nothing else is ever sent.
    const early = await Promise.race([local, after(HEDGE_AFTER_MS)])
    if (early) return early

    // The browser attempt has either missed or is still queueing. Ask the server
    // as well and take whichever finishes first — a browser answer that arrives
    // late is still the better one (its CDN URL streams to the visitor directly).
    //
    // The loser is cancelled rather than abandoned. An abandoned fetch is not a
    // free one: it holds a connection open until the Worker has finished
    // writing a body nobody will read. The controller stands in for the
    // caller's `opts.signal` and follows it, so a cancelled paste still
    // cancels — this only adds a second reason to stop.
    const abandon = new AbortController()
    opts.signal?.addEventListener('abort', () => abandon.abort(), { once: true })
    const server = fromServer(abandon.signal)

    // A server *failure* must not settle the race — tikwm may still be about to
    // answer, and racing the raw promise handed a network error to the caller
    // while a perfectly good browser answer was in flight. Null means "this one
    // has nothing", and the race waits for the other side.
    // A `{success:false}` answer counts as nothing too: it is truthy, and it
    // settled the race while tikwm was still about to succeed.
    const serverOrNull: Promise<ResolveResult | null> = server.then(
      (answer) => (answer?.success ? answer : null),
      () => null,
    )
    const localFirst: Promise<ResolveResult | null> = local.then(
      (answer) => answer ?? serverOrNull,
    )
    const serverFirst: Promise<ResolveResult | null> = serverOrNull.then(
      (answer) => answer ?? local,
    )
    const winner = await Promise.race([localFirst, serverFirst])
    if (winner) {
      abandon.abort()
      return winner
    }
    // Both came back empty: re-await the server so its rejection is what the
    // caller sees, rather than a silent undefined.
    return server
  }

  return fromServer()
}

/** Pause before the silent second resolve, long enough to land on a fresh extractor pick. */
export const SECOND_TRY_DELAY_MS = 500

const LOGIN_GATED_STORY_LINK = /(?:instagram\.com\/(?:stories|s)\/|facebook\.com\/stories\/)/i
const RECOVERABLE_CODES = new Set(['private', 'inconclusive', 'rate_limited', 'timeout', 'network'])
/** Platforms whose "private" give-up is routinely a cold first run (PostHog: IG, FB and X doubled). */
const SECOND_TRY_PLATFORMS = new Set(['instagram', 'facebook', 'twitter'])

/**
 * A failed Instagram, Facebook or X answer worth one silent second run. The
 * chain's give-up line says "private" when every method merely came back
 * empty, which a cold first request does routinely. Stories and highlights are
 * excluded: they are login-gated by design and a second run cannot change that.
 */
export function isRecoverableAnswer(url: string, result: ResolveResult): boolean {
  if (result.success || !SECOND_TRY_PLATFORMS.has(detectPlatform(url))) return false
  if (LOGIN_GATED_STORY_LINK.test(url)) return false
  return RECOVERABLE_CODES.has(failureCode(result.error))
}

async function resolveOnServer(
  url: string,
  type: 'video' | 'audio',
  quality: 'hd' | 'sd',
  format: 'auto' | 'video' | 'audio',
  opts: ResolveOptions,
): Promise<ResolveResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.proToken) headers['X-Pro-Token'] = opts.proToken

  // One retry on the resolve POST itself — the same first-tap-after-a-cold-open
  // radio loss the client's media fetches already ride out (see
  // lessons/2026-09-22-the-download-that-needed-two-taps.md). Only a thrown
  // network error is retried, and only once: a server answer the app can read
  // is never re-sent, so a resolve that Instagram actually refused costs one
  // extractor run, not two.
  const ask = async (): Promise<ResolveResult> => {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers,
      signal: opts.signal,
      body: JSON.stringify({ url, type, quality, format }),
    })
    return response.json()
  }

  return withRetry(
    async () => {
      const first = await ask()
      if (!isRecoverableAnswer(url, first) || opts.signal?.aborted) return first
      // The server answered, but with a give-up that a second run routinely
      // turns into a success (PostHog, 7 days: 62 Instagram "private" and 14
      // rate-limit failures were followed by a success for the same person
      // within two minutes). Ask once more behind the same loading state, and
      // keep the second answer whatever it is.
      await new Promise((r) => setTimeout(r, SECOND_TRY_DELAY_MS))
      if (opts.signal?.aborted) return first
      return ask()
    },
    {
      retries: 1,
      // A user abort is not a network failure: re-sending after a cancelled
      // resolve would hang the request back up behind a closed door.
      isRetryable: (e) =>
        !opts.signal?.aborted &&
        isTransientError(e) &&
        !(e as { response?: { status?: number } }).response,
    },
  )
}
