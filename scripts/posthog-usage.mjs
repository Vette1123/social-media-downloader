#!/usr/bin/env node
/**
 * What people actually use, and what to do about it (masareef's pnpm usage).
 *
 *   pnpm posthog:usage                 last 7 days against the 7 before
 *   pnpm posthog:usage --days 28
 *   pnpm posthog:usage --json
 *
 * Reach per product area (the `area` every event carries — src/lib/analytics.ts
 * EVENT_AREA), events that never fired, new-visitor activation (first_play),
 * the play and support funnels, failure rate per server, rageclicks per route,
 * and a ranked WHAT TO DO list. Humans only: {humans} drops the pre-block fleet
 * and the test cohort.
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'

import { posthogConfig, runQuery } from './lib/posthog.mjs'
import {
  areaReach,
  areaTables,
  neverFired,
  whatToDo,
} from './lib/usage-report.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const D = Math.max(1, Number(option('--days', 7)))
const json = args.includes('--json')

const tables = areaTables(
  readFileSync(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8')
)
const cfg = posthogConfig()

const now = `timestamp > now() - INTERVAL ${D} DAY`
const before = `timestamp > now() - INTERVAL ${2 * D} DAY AND timestamp <= now() - INTERVAL ${D} DAY`

const ROUTE = `coalesce(properties.route, properties.$pathname)`

const queries = {
  active: `SELECT uniqIf(person_id, ${now}) AS active, uniqIf(person_id, ${before}) AS active_before
           FROM events WHERE {humans} AND timestamp > now() - INTERVAL ${2 * D} DAY LIMIT 1`,
  events: `SELECT event, if(event = 'feature_used', toString(properties.feature), '') AS feature,
                  uniqIf(person_id, ${now}) AS people, countIf(${now}) AS events,
                  uniqIf(person_id, ${before}) AS people_before
           FROM events WHERE {humans} AND timestamp > now() - INTERVAL ${2 * D} DAY
             AND event NOT LIKE '$%'
           GROUP BY event, feature LIMIT 2000`,
  activation: `SELECT count() AS new_people, countIf(saved = 1) AS activated,
                      quantileIf(0.5)(to_save_s, saved = 1) AS median_to_save_s
               FROM (SELECT person_id, min(timestamp) AS first_at,
                            maxIf(1, event = 'download_completed') AS saved,
                            dateDiff('second', min(timestamp), minIf(timestamp, event = 'download_completed')) AS to_save_s
                     FROM events WHERE {humans} AND timestamp > now() - INTERVAL 90 DAY
                     GROUP BY person_id HAVING first_at > now() - INTERVAL ${D} DAY)
               LIMIT 1`,
  funnel: `SELECT uniqIf(person_id, event = '$pageview') AS visited,
                  uniqIf(person_id, event = 'link_submitted') AS submitted,
                  uniqIf(person_id, event = 'resolve_succeeded') AS resolved,
                  uniqIf(person_id, event = 'download_started') AS started,
                  uniqIf(person_id, event = 'download_completed') AS saved
           FROM events WHERE {humans} AND ${now} LIMIT 1`,
  platforms: `SELECT toString(properties.platform) AS platform,
                     countIf(event = 'resolve_succeeded') AS ok, countIf(event = 'resolve_failed') AS failed
              FROM events WHERE {humans} AND ${now} AND event IN ('resolve_succeeded', 'resolve_failed')
              GROUP BY platform ORDER BY ok + failed DESC LIMIT 30`,
  top: `SELECT any(properties.content_title) AS title, any(properties.platform) AS platform,
               properties.content_url AS link, uniq(person_id) AS people
        FROM events WHERE {humans} AND ${now} AND event = 'download_completed'
          AND properties.content_url IS NOT NULL
        GROUP BY link ORDER BY people DESC LIMIT 10`,
  pro: `SELECT uniqIf(person_id, event = 'pro_nudge_shown') AS nudged,
               uniqIf(person_id, event = 'pro_cta_clicked') AS cta,
               uniqIf(person_id, event = 'signed_in') AS signed_in
        FROM events WHERE {humans} AND ${now} LIMIT 1`,
  routes: `SELECT ${ROUTE} AS route, uniq(person_id) AS people
           FROM events WHERE {humans} AND ${now} AND event = '$pageview'
           GROUP BY route ORDER BY people DESC LIMIT 15`,
  rage: `SELECT ${ROUTE} AS route, count() AS c, uniq(person_id) AS people
         FROM events WHERE {humans} AND ${now} AND event IN ('$rageclick', '$dead_click')
         GROUP BY route ORDER BY people DESC, c DESC LIMIT 10`,
  errors: `SELECT event, coalesce(nullIf(toString(properties.source), ''), toString(properties.$exception_types)) AS kind,
                  count() AS c, uniq(person_id) AS people
           FROM events WHERE {humans} AND ${now} AND event IN ('$exception', 'api_error')
           GROUP BY event, kind ORDER BY people DESC LIMIT 15`,
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-')
const arrow = (now_, before_) => {
  if (!before_) return ''
  const delta = Math.round((100 * (now_ - before_)) / before_)
  return delta >= 0 ? ` (+${delta}%)` : ` (${delta}%)`
}

try {
  const entries = await Promise.all(
    Object.entries(queries).map(async ([key, sql]) => [
      key,
      await runQuery(cfg, sql),
    ])
  )
  const r = Object.fromEntries(entries)
  const { active, active_before } = r.active[0] ?? {}
  const reach = areaReach(r.events, tables, active, active_before)
  const activationRow = r.activation[0] ?? {}
  const activation = {
    new_people: Number(activationRow.new_people) || 0,
    activated: Number(activationRow.activated) || 0,
    median_to_save_s: activationRow.median_to_save_s,
  }
  activation.rate = activation.new_people
    ? activation.activated / activation.new_people
    : 0
  const pro = Object.fromEntries(
    Object.entries(r.pro[0] ?? {}).map(([k, v]) => [k, Number(v) || 0])
  )
  const todo = whatToDo({
    reach,
    activation,
    platforms: r.platforms,
    pro,
    rage: r.rage,
  })
  const unseen = neverFired(r.events, tables)

  if (json) {
    console.log(
      JSON.stringify(
        {
          days: D,
          active,
          active_before,
          reach,
          activation,
          ...r,
          unseen,
          todo,
        },
        null,
        2
      )
    )
    process.exit(0)
  }

  console.log(
    `\nUsage — last ${D} days vs the ${D} before (${cfg.host}, project ${cfg.project})`
  )
  console.log(`active people: ${active}${arrow(active, active_before)}\n`)

  console.log('REACH BY AREA (share of active people)')
  for (const a of reach) {
    console.log(
      `  ${a.area.padEnd(11)} ${String(a.people).padStart(5)}  ${pct(a.people, active).padStart(4)}   before ${pct(a.before, active_before)}`
    )
  }

  const f = r.funnel[0] ?? {}
  console.log('\nCORE FUNNEL (people)')
  console.log(
    `  visited ${f.visited} → link ${f.submitted} (${pct(f.submitted, f.visited)}) → resolved ${f.resolved} (${pct(f.resolved, f.visited)}) → started ${f.started} → saved ${f.saved} (${pct(f.saved, f.visited)})`
  )

  console.log('\nACTIVATION (people first seen in the window)')
  const median = activation.median_to_save_s
  const medianText = median
    ? `, median ${Math.round(median)}s to first download`
    : ''
  console.log(
    `  ${activation.activated} of ${activation.new_people} saved a file (${pct(activation.activated, activation.new_people)})${medianText}`
  )

  console.log('\nRESOLVER HEALTH BY PLATFORM')
  for (const p of r.platforms) {
    console.log(
      `  ${String(p.platform).padEnd(14)} ok ${String(p.ok).padStart(5)}  failed ${String(p.failed).padStart(5)}  (${pct(p.failed, Number(p.ok) + Number(p.failed))})`
    )
  }

  console.log('\nMOST DOWNLOADED')
  for (const row of r.top) {
    console.log(`  ${String(row.people).padStart(4)}  ${row.platform}  ${String(row.title).slice(0, 60)}`)
  }

  console.log('\nPRO FUNNEL (people)')
  console.log(
    `  nudged ${pro.nudged} · CTA ${pro.cta} · signed in ${pro.signed_in}`
  )

  console.log('\nTOP ROUTES')
  for (const row of r.routes)
    console.log(`  ${String(row.route).padEnd(28)} ${row.people}`)

  console.log('\nERRORS (people)')
  for (const row of r.errors)
    console.log(
      `  ${row.event.padEnd(11)} ${String(row.kind).slice(0, 40).padEnd(40)} ${row.people} people / ${row.c}`
    )

  if (unseen.length) {
    console.log(
      `\nNEVER FIRED in ${D} days (${unseen.length}): ${unseen.join(', ')}`
    )
  }

  console.log('\nWHAT TO DO')
  if (!todo.length) console.log('  nothing tripped a rule')
  todo.forEach((line, i) => console.log(`  ${i + 1}. ${line}`))
} catch (error) {
  console.error(`::error::${error.message}`)
  process.exit(1)
}
