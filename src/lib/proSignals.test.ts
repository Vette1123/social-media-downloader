import { describe, expect, it } from 'vitest'
import { attachedNudgeDue } from './proSignals'

/**
 * The gate the finished-download ask uses. It must not fire on every save
 * (that is how a footnote trains blindness), and the first save of the day
 * must keep its moment.
 */
describe('attachedNudgeDue', () => {
  it('shows on the first and second save of the day', () => {
    expect(attachedNudgeDue(1)).toBe(true)
    expect(attachedNudgeDue(2)).toBe(false)
  })

  it('then gets a turn once every three saves', () => {
    expect(attachedNudgeDue(3)).toBe(true)
    expect(attachedNudgeDue(4)).toBe(false)
    expect(attachedNudgeDue(5)).toBe(false)
    expect(attachedNudgeDue(6)).toBe(true)
    expect(attachedNudgeDue(7)).toBe(false)
  })

  it('reads an empty day (0 resolves) as not due', () => {
    // The nudge only renders beside a finished resolve, which by definition
    // means the count is at least one — zero is the pre-render snapshot and
    // must behave as the quiet state.
    expect(attachedNudgeDue(0)).toBe(false)
  })
})

// A browser with site storage blocked throws from the `localStorage` getter, and
// `typeof localStorage` calls that getter too. The old guard threw during render
// and blanked the page (PostHog early_crash, Android Chrome, 2026-11-14).
describe('storage that refuses access', () => {
  it('records and dismisses without throwing', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access is denied for this document.', 'SecurityError')
      },
    })
    try {
      const { recordResolve, dismissNudge } = await import('./proSignals')
      expect(() => recordResolve()).not.toThrow()
      expect(() => dismissNudge('x')).not.toThrow()
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })
})
