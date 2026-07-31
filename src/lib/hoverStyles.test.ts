import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the hover language against drift.
 *
 * Every card-shaped surface on this site used to invent its own hover: the
 * feature tiles lifted 1px, the platform links lifted 0.5 and used
 * `transition-all`, the FAQ rows put a translucent white film over a card that
 * already sits on a busy background, and the how-it-works steps did nothing.
 * That was fixed once by collapsing them onto `.card-lift` — and then a whole
 * page's worth of cards was added afterwards with the old utilities, so the
 * platform landings (the pages most visitors actually arrive on) kept the bug
 * long after it was "fixed".
 *
 * A comment cannot prevent that recurrence; this can. The primitives live in
 * globals.css: `.card-lift`, `.card-hover`, `.icon-lift`.
 */

const BANNED: Array<{ pattern: RegExp; why: string }> = [
  {
    pattern: /hover:-translate-y/,
    why: 'ad-hoc lift — use .card-lift (or .icon-lift for a small chip)',
  },
  {
    pattern: /hover:border-cyan-/,
    why: 'ad-hoc card accent — use .card-lift or .card-hover',
  },
  {
    pattern: /hover:ring-cyan-/,
    why: 'ad-hoc chip accent — use .icon-lift',
  },
  {
    pattern: /hover:bg-white\/\[/,
    why:
      'translucent hover film over a panel — unreadable on this background; ' +
      'use .card-hover, which goes opaque',
  },
]

/**
 * The gradient CTA owns its own hover by design — it is a button, not a card,
 * and it has no border or panel to treat.
 */
const EXEMPT = /btn-grad/

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...tsxFiles(full))
      continue
    }
    if (entry.name.endsWith('.tsx')) out.push(full)
  }
  return out
}

/** Every quoted className value in the file, one per entry. */
function classNameValues(source: string): string[] {
  const out: string[] = []
  const pattern = /className=(?:\{?)(['"`])([\s\S]*?)\1/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) out.push(match[2])
  return out
}

describe('hover styles', () => {
  const files = tsxFiles(join(process.cwd(), 'src'))

  it('finds the components to check', () => {
    // Guards the guard: a broken walk would make every assertion below pass
    // vacuously, which is exactly how this kind of test rots.
    expect(files.length).toBeGreaterThan(5)
  })

  it('routes every card hover through the shared primitives', () => {
    const violations: string[] = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const value of classNameValues(source)) {
        if (EXEMPT.test(value)) continue
        for (const { pattern, why } of BANNED) {
          if (!pattern.test(value)) continue
          const relative = file.slice(file.indexOf('src'))
          violations.push(`${relative}: ${pattern.source} — ${why}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
