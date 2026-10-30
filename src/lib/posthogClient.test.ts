import { readFileSync } from 'node:fs'
import type { PostHog } from 'posthog-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { afterPageSettles, BOOT_DELAY_MS, bootPostHog, isSquareScreenFleet } from './posthogClient'

const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0'

describe('isSquareScreenFleet', () => {
  it('catches a near-square desktop', () => {
    expect(
      isSquareScreenFleet({ ua: desktop, screenWidth: 1305, screenHeight: 1162 }),
    ).toBe(true)
  })

  it('keeps 16:9, a 5:4 monitor, and a phone', () => {
    const at = (screenWidth: number, screenHeight: number, ua = desktop) =>
      isSquareScreenFleet({ ua, screenWidth, screenHeight })
    expect(at(1920, 1080)).toBe(false)
    expect(at(1280, 1024)).toBe(false)
    expect(at(1000, 900, 'Mozilla/5.0 (Linux; Android 14) Mobile')).toBe(false)
  })
})

describe('bootPostHog', () => {
  it('inits before replaying anything queued, then empties the queue', () => {
    const order: string[] = []
    const pending = [() => order.push('register'), () => order.push('capture')]
    bootPostHog({} as PostHog, () => order.push('init'), pending)
    expect(order).toEqual(['init', 'register', 'capture'])
    expect(pending).toEqual([])
  })
})

describe('afterPageSettles', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function page(readyState: string) {
    const listeners: Record<string, () => void> = {}
    const idle = vi.fn((fn: () => void) => fn())
    vi.useFakeTimers()
    vi.stubGlobal('document', { readyState })
    vi.stubGlobal('window', {
      requestIdleCallback: idle,
      addEventListener: (name: string, fn: () => void) => {
        listeners[name] = fn
      },
    })
    return { listeners, idle }
  }

  it('does nothing until load, then waits out the delay', () => {
    const { listeners } = page('interactive')
    const run = vi.fn()
    afterPageSettles(run)
    vi.advanceTimersByTime(BOOT_DELAY_MS * 10)
    expect(run).not.toHaveBeenCalled()

    listeners.load()
    vi.advanceTimersByTime(BOOT_DELAY_MS - 1)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledOnce()
  })

  it('waits for idle even when the page already loaded', () => {
    const { idle } = page('complete')
    const run = vi.fn()
    afterPageSettles(run)
    expect(idle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(BOOT_DELAY_MS)
    expect(idle).toHaveBeenCalledOnce()
  })
})

describe('AnalyticsProvider boot', () => {
  it('has one trigger: nothing a visitor does can pull the SDK early', () => {
    const source = readFileSync('src/components/AnalyticsProvider.tsx', 'utf8')
    expect(source.split('boot()')).toHaveLength(3)
    expect(source).not.toMatch(/pointerdown|requestIdleCallback/)
  })
})
