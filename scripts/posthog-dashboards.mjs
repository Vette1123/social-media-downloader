// The PostHog dashboards, as data. `pnpm posthog:setup` applies it.
//
//   1. Live & Reach        who is here now, what is being downloaded, from where.
//   2. Weekly Action Board the numbers that decide what to work on this week:
//                          activation, the core funnel, resolver health per
//                          platform, the Pro funnel, errors.
//   3. Growth & Deep-Dive  retention, what people download, feature reach.
//
// HogQL tiles use HUMANS; Trends and Funnels use filterTestAccounts. Edit here
// and re-run: tiles update in place by name.
import {
  funnel,
  hogql,
  lifecycle,
  retention,
  trends,
} from './lib/posthog-insights.mjs'
import { HUMANS, NOT_FLEET, TEST_COHORT_ID } from './lib/posthog.mjs'

const ROUTE = `coalesce(properties.route, properties.$pathname)`
const NAME = 'Social Downloader'

export const PROJECT_SETTINGS = {
  name: 'Social Media Downloader',
  product_description:
    'socialdownloader.space: a free web app that saves public videos, audio and images from social platforms. Visitors paste a link, it resolves, they download the file. No account is needed; Pro is a set of convenience extras granted by hand. Global audience, mostly mobile. Core conversion: download_completed. Activation: first_download. Every custom event carries `area`; every event carries a `route`.',
  anonymize_ips: true,
  test_account_filters: [
    { key: 'id', type: 'cohort', value: TEST_COHORT_ID, operator: 'not_in' },
    { key: NOT_FLEET, type: 'hogql', value: null },
  ],
}

const CORE_FUNNEL = [
  '$pageview',
  'link_submitted',
  'resolve_succeeded',
  'download_started',
  'download_completed',
]

export const DASHBOARDS = [
  {
    key: 'live',
    name: `${NAME} — Live & Reach`,
    description:
      'Right now: who is on the site, what they are downloading, where from. Home dashboard. Humans only.',
    primary: true,
    tiles: [
      {
        name: 'People on the site — last 5 min',
        query: hogql(
          `SELECT uniq(person_id) AS people FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 5 MINUTE`,
          'BoldNumber'
        ),
      },
      {
        name: 'People — last 30 min',
        query: hogql(
          `SELECT uniq(person_id) AS people FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 MINUTE`,
          'BoldNumber'
        ),
      },
      {
        name: 'Downloads today',
        query: hogql(
          `SELECT count() AS downloads FROM events WHERE ${HUMANS} AND event = 'download_completed' AND timestamp > toStartOfDay(now())`,
          'BoldNumber'
        ),
      },
      {
        name: 'Links submitted today',
        query: hogql(
          `SELECT count() AS links FROM events WHERE ${HUMANS} AND event = 'link_submitted' AND timestamp > toStartOfDay(now())`,
          'BoldNumber'
        ),
      },
      {
        name: 'Pageviews, links and downloads per minute — last hour',
        query: hogql(
          `SELECT toStartOfMinute(timestamp) AS minute,
                  countIf(event = '$pageview') AS pageviews,
                  countIf(event = 'link_submitted') AS links,
                  countIf(event = 'download_completed') AS downloads
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 60 MINUTE
           GROUP BY minute ORDER BY minute`,
          'ActionsLineGraph'
        ),
      },
      {
        name: 'Latest downloads',
        query: hogql(
          `SELECT timestamp, properties.platform AS platform, properties.kind AS kind,
                  properties.content_title AS title, properties.content_author AS author,
                  properties.content_url AS link, properties.$geoip_country_code AS country
           FROM events WHERE ${HUMANS} AND event = 'download_completed' AND timestamp > now() - INTERVAL 1 DAY
           ORDER BY timestamp DESC LIMIT 50`
        ),
      },
      {
        name: 'Who is here — last 30 min',
        query: hogql(
          `SELECT dateDiff('minute', max(timestamp), now()) AS minutes_ago,
                  argMax(properties.$geoip_country_code, timestamp) AS country,
                  argMax(${ROUTE}, timestamp) AS route,
                  argMax(event, timestamp) AS last_event,
                  argMax(properties.$device_type, timestamp) AS device,
                  argMax(properties.$browser, timestamp) AS browser,
                  argMax(properties.visit_n, timestamp) AS visit_n,
                  argMax(properties.pro, timestamp) AS pro,
                  count() AS events
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 MINUTE
           GROUP BY person_id ORDER BY minutes_ago ASC, events DESC LIMIT 50`
        ),
      },
      {
        name: 'Live feed — last 60 product events',
        query: hogql(
          `SELECT timestamp, event, properties.area AS area, ${ROUTE} AS route,
                  coalesce(toString(properties.platform), toString(properties.feature), toString(properties.surface), '') AS detail,
                  properties.$geoip_country_code AS country
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 1 DAY
             AND event NOT LIKE '$%'
           ORDER BY timestamp DESC LIMIT 60`
        ),
      },
      {
        name: 'Today by country',
        query: hogql(
          `SELECT properties.$geoip_country_name AS country, uniq(person_id) AS people,
                  uniqIf(person_id, event = 'download_completed') AS downloaded
           FROM events WHERE ${HUMANS} AND timestamp > toStartOfDay(now())
           GROUP BY country ORDER BY people DESC LIMIT 20`
        ),
      },
      {
        name: 'Today by screen',
        query: hogql(
          `SELECT ${ROUTE} AS route, uniq(person_id) AS people, count() AS views
           FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > toStartOfDay(now())
           GROUP BY route ORDER BY people DESC LIMIT 20`
        ),
      },
      {
        name: 'New visitors today by source',
        query: hogql(
          `SELECT coalesce(nullIf(source, '$direct'), 'direct') AS source, count() AS new_people
           FROM (SELECT person_id, min(timestamp) AS first_at,
                        argMin(properties.$referring_domain, timestamp) AS source
                 FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > now() - INTERVAL 90 DAY
                 GROUP BY person_id)
           WHERE first_at > toStartOfDay(now())
           GROUP BY source ORDER BY new_people DESC LIMIT 15`
        ),
      },
      {
        name: 'DAU / WAU / MAU',
        query: trends({
          series: [
            { event: '$pageview', math: 'dau', name: 'Daily' },
            { event: '$pageview', math: 'weekly_active', name: 'Weekly' },
            { event: '$pageview', math: 'monthly_active', name: 'Monthly' },
          ],
          from: '-60d',
        }),
      },
      {
        name: 'Devices — last 7 days',
        query: hogql(
          `SELECT properties.$device_type AS device, properties.$browser AS browser,
                  uniq(person_id) AS people
           FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
           GROUP BY device, browser ORDER BY people DESC LIMIT 15`
        ),
      },
    ],
  },
  {
    key: 'weekly',
    name: `${NAME} — Weekly Action Board`,
    description:
      'The numbers that decide what to work on this week. `pnpm posthog:usage` prints the same with a WHAT TO DO list.',
    tiles: [
      {
        name: 'Active people — this week vs last',
        query: hogql(
          `SELECT uniqIf(person_id, timestamp > now() - INTERVAL 7 DAY) AS this_week,
                  uniqIf(person_id, timestamp <= now() - INTERVAL 7 DAY) AS last_week,
                  round(100 * (this_week - last_week) / greatest(last_week, 1)) AS change_pct
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 14 DAY`
        ),
      },
      {
        name: 'Funnel — visit → link → resolved → started → saved',
        query: funnel({ steps: CORE_FUNNEL, from: '-7d' }),
      },
      {
        name: 'Funnel by platform — link → resolved → saved',
        description: 'The same funnel per platform: where a platform leaks.',
        query: hogql(
          `SELECT toString(properties.platform) AS platform,
                  uniqIf(person_id, event = 'link_submitted') AS submitted,
                  uniqIf(person_id, event = 'resolve_succeeded') AS resolved,
                  uniqIf(person_id, event = 'download_completed') AS saved,
                  round(100 * saved / greatest(submitted, 1), 1) AS end_to_end_pct
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
             AND event IN ('link_submitted', 'resolve_succeeded', 'download_completed')
           GROUP BY platform ORDER BY submitted DESC LIMIT 20`
        ),
      },
      {
        name: 'Activation — new visitors who downloaded, by week',
        query: hogql(
          `SELECT toStartOfWeek(first_at) AS week, count() AS new_people,
                  countIf(saved = 1) AS saved,
                  round(100 * saved / greatest(new_people, 1), 1) AS activation_pct
           FROM (SELECT person_id, min(timestamp) AS first_at, maxIf(1, event = 'download_completed') AS saved
                 FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 120 DAY GROUP BY person_id)
           WHERE first_at > now() - INTERVAL 84 DAY
           GROUP BY week ORDER BY week`,
          'ActionsLineGraph'
        ),
      },
      {
        name: 'Time to first download (new browsers)',
        query: hogql(
          `SELECT toStartOfWeek(timestamp) AS week, count() AS first_downloads,
                  round(quantile(0.5)(toFloat(properties.since_first_visit_s))) AS median_s,
                  round(quantile(0.75)(toFloat(properties.since_first_visit_s))) AS p75_s
           FROM events WHERE ${HUMANS} AND event = 'first_download'
           GROUP BY week ORDER BY week DESC LIMIT 12`
        ),
      },
      {
        name: 'Resolver health by platform',
        query: hogql(
          `SELECT toString(properties.platform) AS platform,
                  countIf(event = 'resolve_succeeded') AS ok,
                  countIf(event = 'resolve_failed') AS failed,
                  round(100 * failed / greatest(ok + failed, 1), 1) AS failure_pct,
                  round(quantile(0.5)(toFloat(properties.duration_ms))) AS median_ms
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
             AND event IN ('resolve_succeeded', 'resolve_failed')
           GROUP BY platform ORDER BY ok + failed DESC LIMIT 20`
        ),
      },
      {
        name: 'Why resolves failed — platform and reason',
        query: hogql(
          `SELECT toString(properties.platform) AS platform, toString(properties.code) AS reason,
                  uniq(person_id) AS people, count() AS failures
           FROM events WHERE ${HUMANS} AND event = 'resolve_failed' AND timestamp > now() - INTERVAL 7 DAY
           GROUP BY platform, reason ORDER BY failures DESC LIMIT 25`
        ),
      },
      {
        name: 'Resolve failures per day by platform',
        query: trends({ series: ['resolve_failed'], from: '-30d', breakdown: 'platform' }),
      },
      {
        name: 'Transfer health — by kind',
        query: hogql(
          `SELECT toString(properties.kind) AS kind,
                  countIf(event = 'download_started') AS started,
                  countIf(event = 'download_completed') AS completed,
                  countIf(event = 'download_failed') AS failed,
                  countIf(event = 'download_canceled') AS canceled,
                  round(100 * failed / greatest(started, 1), 1) AS failure_pct
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
             AND event IN ('download_started', 'download_completed', 'download_failed', 'download_canceled')
           GROUP BY kind ORDER BY started DESC LIMIT 15`
        ),
      },
      {
        name: 'How files were delivered',
        query: trends({
          series: ['download_completed'],
          from: '-30d',
          breakdown: 'delivery',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Links refused before a request',
        query: trends({
          series: ['link_rejected'],
          from: '-30d',
          breakdown: 'reason',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Funnel — Pro nudge → CTA → sign in',
        query: funnel({
          steps: ['pro_nudge_shown', 'pro_cta_clicked', 'signed_in'],
          from: '-60d',
          windowDays: 14,
        }),
      },
      {
        name: 'Pro CTAs — by surface',
        query: trends({
          series: ['pro_cta_clicked'],
          from: '-30d',
          breakdown: 'surface',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Errors — top issues, last 7 days',
        query: hogql(
          `SELECT toString(properties.$exception_types) AS type,
                  substring(toString(properties.$exception_values), 1, 120) AS message,
                  ${ROUTE} AS route, uniq(person_id) AS people, count() AS events
           FROM events WHERE ${HUMANS} AND event = '$exception' AND timestamp > now() - INTERVAL 7 DAY
           GROUP BY type, message, route ORDER BY people DESC LIMIT 20`
        ),
      },
      {
        name: 'Handled failures — api_error by source',
        query: hogql(
          `SELECT toString(properties.source) AS source, properties.status AS status,
                  properties.expected AS expected, uniq(person_id) AS people, count() AS events
           FROM events WHERE ${HUMANS} AND event = 'api_error' AND timestamp > now() - INTERVAL 7 DAY
           GROUP BY source, status, expected ORDER BY people DESC LIMIT 20`
        ),
      },
      {
        name: 'Worker failures — by route and status',
        query: hogql(
          `SELECT toString(properties.route) AS route, properties.status AS status,
                  substring(toString(properties.message), 1, 100) AS message, count() AS events
           FROM events WHERE event = 'server_error' AND timestamp > now() - INTERVAL 7 DAY
           GROUP BY route, status, message ORDER BY events DESC LIMIT 20`
        ),
      },
      {
        name: 'Frustration — rage & dead clicks by screen',
        query: hogql(
          `SELECT ${ROUTE} AS route, countIf(event = '$rageclick') AS rageclicks,
                  countIf(event = '$dead_click') AS dead_clicks, uniq(person_id) AS people
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
             AND event IN ('$rageclick', '$dead_click')
           GROUP BY route ORDER BY people DESC LIMIT 15`
        ),
      },
      {
        name: 'Retry pressed — by surface',
        query: trends({
          series: ['retry_clicked'],
          from: '-30d',
          breakdown: 'surface',
          display: 'ActionsBarValue',
        }),
      },
    ],
  },
  {
    key: 'growth',
    name: `${NAME} — Growth & Deep-Dive`,
    description:
      'Retention, what people download, and reach by product area and feature. Test accounts filtered.',
    tiles: [
      {
        name: 'Retention — visitors who come back to download (weekly)',
        query: retention({ start: '$pageview', returning: 'download_completed' }),
      },
      {
        name: 'Retention — after a first download (weekly)',
        query: retention({ start: 'first_download', returning: 'download_completed' }),
      },
      {
        name: 'Lifecycle — new, returning, resurrecting, dormant',
        query: lifecycle({}),
      },
      {
        name: 'Downloads by platform',
        query: trends({
          series: ['download_completed'],
          interval: 'week',
          from: '-84d',
          breakdown: 'platform',
        }),
      },
      {
        name: 'Most downloaded — last 30 days',
        query: hogql(
          `SELECT any(properties.content_title) AS title, any(properties.content_author) AS author,
                  any(properties.platform) AS platform, properties.content_url AS link,
                  uniq(person_id) AS people, count() AS downloads
           FROM events WHERE ${HUMANS} AND event = 'download_completed' AND timestamp > now() - INTERVAL 30 DAY
             AND properties.content_url IS NOT NULL
           GROUP BY link ORDER BY people DESC, downloads DESC LIMIT 50`
        ),
      },
      {
        name: 'Top creators — last 30 days',
        query: hogql(
          `SELECT properties.content_author AS author, any(properties.platform) AS platform,
                  uniq(person_id) AS people, count() AS downloads
           FROM events WHERE ${HUMANS} AND event = 'download_completed' AND timestamp > now() - INTERVAL 30 DAY
             AND properties.content_author IS NOT NULL
           GROUP BY author ORDER BY people DESC LIMIT 30`
        ),
      },
      {
        name: 'What kind of file — by kind and content type',
        query: hogql(
          `SELECT toString(properties.kind) AS kind, toString(properties.content_type) AS content,
                  uniq(person_id) AS people, count() AS downloads,
                  round(avg(toFloat(properties.size_mb)), 1) AS avg_mb
           FROM events WHERE ${HUMANS} AND event = 'download_completed' AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY kind, content ORDER BY downloads DESC LIMIT 20`
        ),
      },
      {
        name: 'Length of what people save',
        query: hogql(
          `SELECT multiIf(s < 30, '1. under 30s', s < 180, '2. 30s-3m', s < 900, '3. 3-15m', s < 3600, '4. 15-60m', '5. over 1h') AS length,
                  count() AS downloads
           FROM (SELECT toFloat(properties.duration_s) AS s FROM events
                 WHERE ${HUMANS} AND event = 'download_completed' AND timestamp > now() - INTERVAL 30 DAY
                   AND properties.duration_s IS NOT NULL)
           GROUP BY length ORDER BY length`,
          'ActionsBar'
        ),
      },
      {
        name: 'Format and quality asked for',
        query: hogql(
          `SELECT toString(properties.format) AS format, toString(properties.quality) AS quality,
                  uniq(person_id) AS people, count() AS links
           FROM events WHERE ${HUMANS} AND event = 'link_submitted' AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY format, quality ORDER BY links DESC LIMIT 15`
        ),
      },
      {
        name: 'Where links come from',
        query: trends({
          series: ['link_submitted'],
          from: '-30d',
          breakdown: 'source',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Reach by product area (weekly people)',
        query: trends({
          series: [{ event: null, math: 'dau', name: 'People' }],
          interval: 'week',
          from: '-84d',
          breakdown: 'area',
        }),
      },
      {
        name: 'Feature use by feature (people)',
        query: trends({
          series: [{ event: 'feature_used', math: 'dau', name: 'People' }],
          interval: 'week',
          from: '-84d',
          breakdown: 'feature',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Batches — size and success',
        query: hogql(
          `SELECT toString(properties.surface) AS surface, count() AS batches,
                  round(avg(toFloat(properties.count)), 1) AS avg_links,
                  sum(toFloat(properties.ok)) AS ok, sum(toFloat(properties.failed)) AS failed
           FROM events WHERE ${HUMANS} AND event = 'batch_finished' AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY surface ORDER BY batches DESC LIMIT 5`
        ),
      },
      {
        name: 'Screens by people — last 30 days',
        query: hogql(
          `SELECT ${ROUTE} AS route, uniq(person_id) AS people, count() AS views
           FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY route ORDER BY people DESC LIMIT 30`
        ),
      },
      {
        name: 'Downloads — anonymous vs signed in vs Pro',
        query: hogql(
          `SELECT multiIf(properties.pro = true, 'pro', properties.signed_in = true, 'signed in', 'anonymous') AS who,
                  uniq(person_id) AS people, count() AS downloads
           FROM events WHERE ${HUMANS} AND event = 'download_completed' AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY who ORDER BY downloads DESC`
        ),
      },
      {
        name: 'Visits per person (visit_n at last event, 30 days)',
        query: hogql(
          `SELECT multiIf(v = 1, '1', v <= 3, '2-3', v <= 10, '4-10', '11+') AS visits, count() AS people
           FROM (SELECT person_id, max(toInt(properties.visit_n)) AS v FROM events
                 WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 DAY AND properties.visit_n IS NOT NULL
                 GROUP BY person_id)
           GROUP BY visits ORDER BY visits`,
          'ActionsBar'
        ),
      },
      {
        name: 'Install funnel — installable → prompted → installed',
        query: funnel({
          steps: ['pwa_installable', 'pwa_prompted', 'pwa_installed'],
          from: '-60d',
          windowDays: 14,
        }),
      },
      {
        name: 'Settings changed — by pref',
        query: trends({
          series: ['pref_changed'],
          from: '-60d',
          breakdown: 'key',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Shares — by surface and method',
        query: hogql(
          `SELECT toString(properties.surface) AS surface, toString(properties.method) AS method,
                  toString(properties.outcome) AS outcome, uniq(person_id) AS people, count() AS shares
           FROM events WHERE ${HUMANS} AND event = 'shared' AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY surface, method, outcome ORDER BY shares DESC LIMIT 20`
        ),
      },
    ],
  },
]

/**
 * Daily alerts, each on its own small Trends insight on the Weekly board. The
 * floors are guesses until a week of real traffic exists: re-read them then.
 * Downloads use a LOWER bound: a build that fails to boot sends no events, so
 * silence is the only symptom.
 */
export const ALERTS = [
  {
    name: 'Silence — fewer than 5 downloads a day',
    tile: {
      name: 'Alert — downloads per day',
      query: trends({ series: ['download_completed'], from: '-14d', display: 'ActionsLineGraph' }),
    },
    lower: 5,
  },
  {
    name: 'Spike — more than 200 failed resolves a day',
    tile: {
      name: 'Alert — failed resolves per day',
      query: trends({ series: ['resolve_failed'], from: '-14d' }),
    },
    upper: 200,
  },
  {
    name: 'Spike — exceptions for more than 15 people a day',
    tile: {
      name: 'Alert — people hitting exceptions per day',
      query: trends({
        series: [{ event: '$exception', math: 'dau', name: 'People' }],
        from: '-14d',
      }),
    },
    upper: 15,
  },
  {
    name: 'Spike — more than 50 Worker failures a day',
    tile: {
      name: 'Alert — Worker failures per day',
      query: trends({ series: ['server_error'], from: '-14d' }),
    },
    upper: 50,
  },
]
