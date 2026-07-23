// Tiny in-memory response cache for resolved downloads. No external store is
// provisioned (no KV/Redis), so this is a module-level Map that lives on a warm
// serverless instance and dies with it — a best-effort cache, not a durable one.
//
// Why it still helps: the same link gets resolved repeatedly in tight windows —
// double-tapping Download, re-picking HD/SD/MP3 on a result, re-tapping a Recent
// entry, or a batch that contains a dup. Serving those repeats from memory skips
// a full Cobalt round-trip (and its quota + latency).
//
// Why the TTL is short: the media URLs a resolve returns (Cobalt tunnels, signed
// CDN links) are EPHEMERAL — they expire in minutes. Caching them long would
// hand back a dead download URL. So the TTL is deliberately small: long enough
// to absorb immediate repeats (the download happens seconds after the resolve,
// while the URL is still live), short enough that a re-tap minutes later
// re-resolves fresh. Never cache failures.

const TTL_MS = 3 * 60 * 1000 // 3 minutes — see note above on ephemeral URLs.
const MAX_ENTRIES = 200 // hard cap so a warm instance can't grow unbounded.

interface Entry {
  value: unknown
  expires: number
}

// Insertion-ordered Map doubles as a cheap LRU: on read we re-insert (moves the
// key to the newest slot); on overflow we evict the oldest (first) key.
const store = new Map<string, Entry>()

export function getCached<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null
  if (hit.expires <= Date.now()) {
    store.delete(key)
    return null
  }
  // Touch: move to newest so it survives eviction longest.
  store.delete(key)
  store.set(key, hit)
  return hit.value as T
}

export function setCached(key: string, value: unknown): void {
  if (store.has(key)) store.delete(key)
  store.set(key, { value, expires: Date.now() + TTL_MS })
  // Evict oldest entries past the cap (usually just one per insert).
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}
