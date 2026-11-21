// The pure half of scripts/seo-gsc.mjs (ported from masareef): turns Search Console rows into the two lists that
// decide the next SEO move. Kept apart so the test can feed it rows without a network.

/** Rows Google ranks on page 1-2 but nobody clicks: one push (a page, a better title) from traffic. */
export function strikingDistance(rows, { minImpressions = 5, from = 4, to = 20 } = {}) {
  return rows
    .filter((r) => r.impressions >= minImpressions && r.position >= from && r.position <= to)
    .sort((a, b) => b.impressions - a.impressions);
}

/** Rows that are seen often and never clicked: the title or description is not answering the query. */
export function seenNotClicked(rows, { minImpressions = 20 } = {}) {
  return rows.filter((r) => r.clicks === 0 && r.impressions >= minImpressions).sort((a, b) => b.impressions - a.impressions);
}

/** Google's operator-stuffed queries (`-site:facebook.com …`) are scrapers, not people. */
export const isScraper = (q) => /(^|\s)-?(site|intitle|inurl):/i.test(q);

/** API rows ({keys:[x], clicks, impressions, ctr, position}) to flat rows, scrapers dropped. */
export function flatten(apiRows = []) {
  return apiRows
    .map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 }))
    .filter((r) => !isScraper(r.key));
}
