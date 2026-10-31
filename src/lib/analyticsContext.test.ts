import { describe, expect, it } from 'vitest'
import {
  isPriorUseKey,
  milestonesFor,
  nextVisit,
  routeTemplate,
  VISIT_GAP_MS,
  visitTraits,
} from './analyticsContext'

const fresh = { first_at: 0, last_at: 0, visit_n: 1, seeded: false }

describe('routeTemplate', () => {
  it('folds the trailing slash', () => {
    expect(routeTemplate('/pro/')).toBe('/pro')
    expect(routeTemplate('/')).toBe('/')
  })

  it('folds the language, so one screen stays one route', () => {
    expect(routeTemplate('/es/tiktok-downloader')).toBe('/tiktok-downloader')
    expect(routeTemplate('/ar')).toBe('/')
    expect(routeTemplate('/id/')).toBe('/')
  })
})

describe('nextVisit', () => {
  it('starts a browser at visit 1, seeded when it was already here', () => {
    expect(nextVisit(null, 5, true).record).toMatchObject({ visit_n: 1, seeded: true })
  })

  it('only counts a new visit past the gap', () => {
    expect(nextVisit(fresh, VISIT_GAP_MS, false).newVisit).toBe(false)
    expect(nextVisit(fresh, VISIT_GAP_MS + 1, false).record.visit_n).toBe(2)
  })
})

describe('visitTraits', () => {
  it('marks a seeded browser as returning', () => {
    expect(visitTraits({ ...fresh, seeded: true }, 86_400_000)).toEqual({
      visit_n: 1,
      days_since_first_visit: 1,
      returning_visitor: true,
    })
  })
})

describe('milestonesFor', () => {
  const none = () => false

  it('a first download earns both milestones', () => {
    const keys = milestonesFor('download_completed', fresh, 9000, none).map((m) => m.key)
    expect(keys).toEqual(['first_core_use', 'first_download'])
  })

  it('a resolve earns only core use', () => {
    const keys = milestonesFor('resolve_succeeded', fresh, 9000, none).map((m) => m.key)
    expect(keys).toEqual(['first_core_use'])
  })

  it('a seeded browser earns nothing', () => {
    const seeded = { ...fresh, seeded: true }
    expect(milestonesFor('download_completed', seeded, 9000, none)).toEqual([])
  })

  it('a claimed latch does not fire again', () => {
    expect(milestonesFor('download_completed', fresh, 9000, () => true)).toEqual([])
  })
})

describe('isPriorUseKey', () => {
  it('counts both spellings of the app prefix', () => {
    expect(isPriorUseKey('smd:resolves')).toBe(true)
    expect(isPriorUseKey('smd_profile')).toBe(true)
  })

  it('ignores analytics latches and other sites', () => {
    expect(isPriorUseKey('smd_visit')).toBe(false)
    expect(isPriorUseKey('smd_once:first_download')).toBe(false)
    expect(isPriorUseKey('smd_ph_signed_in')).toBe(false)
    expect(isPriorUseKey('other')).toBe(false)
    expect(isPriorUseKey(null)).toBe(false)
  })
})
