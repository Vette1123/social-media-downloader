import type { PostHog } from 'posthog-js'
import { describe, expect, it } from 'vitest'
import { bootPostHog, isSquareScreenFleet } from './posthogClient'

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
