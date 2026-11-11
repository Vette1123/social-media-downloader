/**
 * A sliding-window pacer: at most `limit` starts in any `windowMs`.
 *
 * The smoke suite needs it because the zone rate-limits /api/download at 30
 * requests per 10 s per IP (scripts/cf-setup.mjs, RATE_LIMIT_RULE). Six workers
 * on warm cache answers outran that on pass 2 (2026-11-11): Twitch and
 * Dailymotion got Cloudflare's HTML 429 and passed when re-run alone, so the
 * suite was failing on our own WAF, not on the site.
 *
 * Callers are serialised through one promise chain, so concurrent workers
 * cannot all see a free slot at once. `now` and `sleep` are injectable for the
 * test.
 */
export function createPacer({
  limit,
  windowMs,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const starts = []
  let chain = Promise.resolve()

  async function acquire() {
    while (starts.length && now() - starts[0] >= windowMs) starts.shift()
    if (starts.length >= limit) {
      await sleep(starts[0] + windowMs - now())
      return acquire()
    }
    starts.push(now())
  }

  return () => {
    const turn = chain.then(acquire)
    chain = turn
    return turn
  }
}
