// Single source of truth for "when was this site last updated".
//
// Evaluated once per build (both the sitemap and the JSON-LD graph are
// statically prerendered), so every deploy publishes a fresh `lastmod` /
// `dateModified` instead of a hand-edited constant that silently goes stale.
//
// SOURCE_DATE_EPOCH (seconds) is honoured when present so reproducible builds
// can pin the value.
function resolveBuildDate(): Date {
  const epoch = process.env.SOURCE_DATE_EPOCH
  if (epoch) {
    const seconds = Number(epoch)
    if (Number.isFinite(seconds)) return new Date(seconds * 1000)
  }
  return new Date()
}

export const buildDate = resolveBuildDate()

/** ISO timestamp — for sitemap `<lastmod>`. */
export const buildTimestamp = buildDate.toISOString()

/** `YYYY-MM-DD` — for schema.org `dateModified`. */
export const buildDay = buildTimestamp.slice(0, 10)
