// Pure halves of `pnpm posthog:usage` (tests/usage-report.test.ts).

/**
 * EVENT_AREA and FEATURE_AREA out of src/lib/analytics.ts, read as text: the
 * script must not need a TypeScript toolchain, and the analytics module is
 * the one source of truth (masareef's posthog-usage reads track.ts the same way).
 *
 * @param {string} source
 * @returns {{ eventArea: Record<string, string>, featureArea: Record<string, string> }}
 */
export function areaTables(source) {
  /** @param {string} name */
  const block = (name) => {
    const start = source.indexOf(`export const ${name} = {`)
    if (start === -1) throw new Error(`${name} not found in src/lib/analytics.ts`)
    const end = source.indexOf('}', start)
    /** @type {Record<string, string>} */
    const map = {}
    for (const match of source
      .slice(start, end)
      .matchAll(/^\s+([a-z_$]+): '([a-z]+)',/gm)) {
      map[match[1]] = match[2]
    }
    return map
  }
  return { eventArea: block('EVENT_AREA'), featureArea: block('FEATURE_AREA') }
}

/** The area an (event, feature) row reports under. */
export function areaOf(row, tables) {
  if (row.event === 'feature_used' && row.feature) {
    return tables.featureArea[row.feature] ?? 'discover'
  }
  return tables.eventArea[row.event] ?? null
}

/**
 * Reach per area as a share of active people, now vs the previous window.
 * Per-area people is the MAX over its events — a lower bound, because one
 * person using two events of an area is counted once either way.
 */
export function areaReach(rows, tables, active, activeBefore) {
  const areas = {}
  for (const row of rows) {
    const area = areaOf(row, tables)
    if (!area) continue
    const entry = (areas[area] ??= { area, people: 0, before: 0 })
    entry.people = Math.max(entry.people, Number(row.people) || 0)
    entry.before = Math.max(entry.before, Number(row.people_before) || 0)
  }
  return Object.values(areas)
    .map((entry) => ({
      ...entry,
      share: active ? entry.people / active : 0,
      share_before: activeBefore ? entry.before / activeBefore : 0,
    }))
    .sort((a, b) => b.people - a.people)
}

/** Events defined in EVENT_AREA that no human sent in the window. */
export function neverFired(rows, tables) {
  const seen = new Set(
    rows.filter((r) => Number(r.people) > 0).map((r) => r.event)
  )
  return Object.keys(tables.eventArea).filter((event) => !seen.has(event))
}

const pct = (n) => `${Math.round(n * 100)}%`

/**
 * Rule-of-thumb actions, ranked. Each one names the number that tripped it so
 * the line can be checked instead of trusted.
 */
export function whatToDo({ reach, activation, platforms, pro, rage }) {
  const out = []
  if (activation.new_people >= 20 && activation.rate < 0.25) {
    out.push(
      `Only ${pct(activation.rate)} of ${activation.new_people} new visitors saved a file — the landing → download path is the biggest lever (first_download).`
    )
  }
  for (const row of platforms) {
    const total = Number(row.ok) + Number(row.failed)
    const rate = total ? Number(row.failed) / total : 0
    if (Number(row.failed) >= 10 && rate > 0.3) {
      out.push(
        `${row.platform} failed ${row.failed} of ${total} resolves (${pct(rate)}) — check its extractor chain.`
      )
    }
  }
  for (const area of reach) {
    if (area.share_before > 0.05 && area.share < area.share_before * 0.7) {
      out.push(
        `"${area.area}" reach fell from ${pct(area.share_before)} to ${pct(area.share)} of active people — something in it may have broken.`
      )
    }
  }
  if (pro.cta >= 10 && pro.signed_in === 0) {
    out.push(
      `${pro.cta} people clicked a Pro link and nobody signed in — /pro is losing them.`
    )
  }
  // People, not clicks: one person hammering a control is 30 clicks and one
  // anecdote (a "hotspot" of 124 was two people).
  const hot = rage[0]
  if (hot && Number(hot.people) >= 5) {
    out.push(
      `Frustration hotspot: ${hot.route} — ${hot.people} people rage/dead-clicked (${hot.c} clicks); watch a replay there.`
    )
  }
  return out
}
