import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canWarm, WARM_LIMIT, warmOnFirstInteraction } from './warmPrefetch'

const SOURCE_ROOT = 'src'
const WRAPPER = join('src', 'components', 'IntentLink.tsx')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return tsxFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

describe('link prefetching', () => {
  it('goes through IntentLink, so nothing prefetches on sight', () => {
    const offenders = tsxFiles(SOURCE_ROOT).filter(
      (file) =>
        file !== WRAPPER &&
        /from ['"]next\/link['"]/.test(readFileSync(file, 'utf8')),
    )

    expect(offenders).toEqual([])
  })

  it('still never prefetches on sight: the default would add ~38 KiB per link to the load', () => {
    const wrapper = readFileSync(WRAPPER, 'utf8')
    expect(wrapper).toContain('prefetch={intent ? null : false}')
    expect(wrapper).not.toMatch(/prefetch=\{(true|undefined)\}/)
  })

  it('warms at most WARM_LIMIT links, from one place, after the first interaction', () => {
    expect(WARM_LIMIT).toBeLessThanOrEqual(3)
    const users = tsxFiles(SOURCE_ROOT).filter(
      (file) => file !== WRAPPER && /\swarm=\{/.test(readFileSync(file, 'utf8')),
    )
    expect(users).toEqual([join('src', 'components', 'HomeLanding.tsx')])
    expect(readFileSync(users[0], 'utf8')).toContain('warm={index < WARM_LIMIT}')
  })
})

describe('warmOnFirstInteraction', () => {
  const idleNow = (run: () => void) => run()

  it('does nothing until a real interaction, then runs once', () => {
    const target = new EventTarget()
    let runs = 0
    warmOnFirstInteraction(target, () => runs++, idleNow)
    expect(runs).toBe(0)
    target.dispatchEvent(new Event('pointerdown'))
    target.dispatchEvent(new Event('keydown'))
    expect(runs).toBe(1)
  })

  it('cleanup removes the listeners', () => {
    const target = new EventTarget()
    let runs = 0
    const stop = warmOnFirstInteraction(target, () => runs++, idleNow)
    stop()
    target.dispatchEvent(new Event('touchstart'))
    expect(runs).toBe(0)
  })
})

describe('canWarm', () => {
  it('skips Save-Data and 2G connections, allows the rest', () => {
    expect(canWarm({ saveData: true })).toBe(false)
    expect(canWarm({ effectiveType: '2g' })).toBe(false)
    expect(canWarm({ effectiveType: 'slow-2g' })).toBe(false)
    expect(canWarm({ effectiveType: '4g' })).toBe(true)
    expect(canWarm(undefined)).toBe(true)
  })
})
