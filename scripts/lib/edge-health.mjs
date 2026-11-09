/**
 * Who the edge may never stop, and which stops say nothing about that.
 *
 * Shared by scripts/cf-setup.mjs (`waf` writes the probe rule, `health` reads
 * the firewall events back) so the rule and the check agree on one list.
 */

/**
 * Extensions nothing here serves. `out/` contains no .php/.asp/.jpg at all —
 * checked, not assumed — so no real request can match, and every hit is a
 * vulnerability scan.
 */
export const PROBE_EXTENSIONS = ['.php', '.asp', '.aspx', '.cgi', '.env', '.sql', '.bak']

/**
 * Clients whose challenge or block is a defect, not a defence.
 *
 * Search crawlers first: a challenge to one of these is an unindexed page. Then
 * this project's own senders — `indexnow` submits the deployed sitemap after
 * every deploy and swallows its own failures, so it fails silently by design;
 * the webhook robots pay for support that never gets granted.
 */
export const HEALTH_MUST_PASS = [
  /googlebot/i,
  /google-inspectiontool|googleagent|^google$/i,
  /bingbot|duckduckbot|yandexbot|applebot|baiduspider/i,
  /gptbot|oai-searchbot|chatgpt-user|perplexity|claudebot|anthropic/i,
  /facebookexternalhit|twitterbot|telegrambot|whatsapp|discordbot|linkedinbot|slackbot/i,
  /socialdownloader-indexnow/i,
  /creem/i,
]

/** A path no page lives at: the probe rule's own match, so a stop there is the rule working. */
export function isProbePath(path) {
  const lower = String(path ?? '').toLowerCase()
  return PROBE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/**
 * A stop that means a crawler or sender lost a real page.
 *
 * A user agent is a claim anyone can type. Scanners wear `bingbot` and
 * `Googlebot` precisely because sites wave those through, and on 2026-11-02 the
 * weekly run failed on 13 such groups — every one a single IP asking for
 * `/core/.env` or `/env.bak`. A failure that fires on scanners every week stops
 * being read, and then the one real Bingbot block goes unseen with it.
 */
export function isMustPassStop(event) {
  if (isProbePath(event.clientRequestPath)) return false
  const agent = event.userAgent ?? ''
  return HEALTH_MUST_PASS.some((pattern) => pattern.test(agent))
}
