/**
 * The Worker's own failures, reported to PostHog.
 *
 * The browser sees a failed resolve, but not a route that crashed for something
 * that is not a browser, or the reason behind a 500. A plain `fetch` rather than
 * an SDK: the bundle has a startup budget (`pnpm cf:startup`), and each
 * subrequest costs CPU, which is why only 5xx responses and throws are sent.
 */

import { scrubText } from './analyticsPrivacy'

const CAPTURE_URL = 'https://eu.i.posthog.com/batch/'

export interface ServerFailure {
  route: string
  status: number
  error?: unknown
}

/** Pure, so the wire format is pinned without a network. */
export function serverFailureBatch(
  key: string,
  { route, status, error }: ServerFailure,
  country: string | undefined,
) {
  const message = scrubText(
    error instanceof Error ? error.message : `HTTP ${status}`,
  ).slice(0, 200)
  const properties = {
    // One shared id: a server has no person, and must never create one.
    $process_person_profile: false,
    area: 'health',
    route,
    status,
    message,
    country,
  }
  return {
    api_key: key,
    batch: [
      { event: 'server_error', distinct_id: 'worker', properties },
      {
        event: '$exception',
        distinct_id: 'worker',
        properties: {
          ...properties,
          $exception_fingerprint: `worker:${route}:${status}`,
          $exception_list: [
            {
              type: error instanceof Error ? error.name : 'WorkerResponse',
              value: `[${route}] ${message}`,
              mechanism: { handled: true, synthetic: !(error instanceof Error) },
            },
          ],
        },
      },
    ],
  }
}

export function reportServerFailure(
  request: Request,
  env: { POSTHOG_PROJECT_KEY?: string },
  ctx: { waitUntil: (promise: Promise<unknown>) => void },
  failure: ServerFailure,
): void {
  const key = env.POSTHOG_PROJECT_KEY
  if (!key) return
  const country = (request as Request & { cf?: { country?: string } }).cf?.country
  ctx.waitUntil(
    fetch(CAPTURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serverFailureBatch(key, failure, country)),
    }).catch(() => undefined),
  )
}
