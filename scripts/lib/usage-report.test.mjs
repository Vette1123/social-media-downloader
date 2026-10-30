import { describe, expect, it } from 'vitest'
import { areaTables, neverFired, whatToDo } from './usage-report.mjs'

const quiet = {
  reach: [],
  activation: { new_people: 0, rate: 0 },
  platforms: [],
  pro: { cta: 0, signed_in: 0 },
  rage: [],
}

describe('whatToDo', () => {
  it('stays silent when nothing tripped', () => {
    expect(whatToDo(quiet)).toEqual([])
  })

  it('names a failing platform with its number', () => {
    const [line] = whatToDo({
      ...quiet,
      platforms: [{ platform: 'tiktok', ok: '20', failed: '20' }],
    })
    expect(line).toContain('tiktok failed 20 of 40')
  })

  it('names a Pro page that loses everyone', () => {
    const [line] = whatToDo({ ...quiet, pro: { cta: 12, signed_in: 0 } })
    expect(line).toContain('12 people clicked a Pro link')
  })
})

describe('areaTables', () => {
  it('reads the real event map, and names what never fired', () => {
    const source = `export const EVENT_AREA = {
  link_submitted: 'resolve',
  shared: 'sharing',
} as const
export const FEATURE_AREA = {
  preview: 'download',
} as const`
    const tables = areaTables(source)
    expect(tables.featureArea.preview).toBe('download')
    expect(
      neverFired([{ event: 'shared', people: '1' }], tables),
    ).toEqual(['link_submitted'])
  })
})
