import { describe, expect, it } from 'vitest'
import {
  SPLASH_DEVICES,
  parseSplashSize,
  splashMedia,
  splashPath,
  splashPixels,
} from './splashDevices'

describe('splash device list', () => {
  it('covers the phones and tablets people actually launch from', () => {
    expect(SPLASH_DEVICES.length).toBeGreaterThan(12)
  })

  /**
   * Two devices with the same pixel dimensions would generate the same route
   * twice. `generateStaticParams` does not reject duplicates — it renders the
   * same PNG twice and doubles that image's build cost silently.
   */
  it('generates a unique route per device', () => {
    const paths = SPLASH_DEVICES.map(splashPath)
    expect(new Set(paths).size).toBe(paths.length)
  })

  /**
   * Safari matches on all three clauses at once and has no fallback: a query
   * missing the pixel ratio matches a 1x device that does not exist, and the
   * launch screen silently stays blank.
   */
  it('writes a media query Safari can match exactly', () => {
    const device = SPLASH_DEVICES.find((d) => d.width === 393 && d.ratio === 3)
    expect(device).toBeDefined()
    expect(splashMedia(device!)).toBe(
      '(device-width: 393px) and (device-height: 852px) ' +
        'and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
    )
    expect(splashPath(device!)).toBe('/splash/1179x2556')
  })

  it('renders at device pixels, not CSS pixels', () => {
    expect(splashPixels({ width: 430, height: 932, ratio: 3, label: '' })).toEqual({
      width: 1290,
      height: 2796,
    })
  })
})

describe('parseSplashSize', () => {
  it('round-trips every generated route', () => {
    for (const device of SPLASH_DEVICES) {
      const size = splashPath(device).replace('/splash/', '')
      expect(parseSplashSize(size)).toEqual(splashPixels(device))
    }
  })

  it('refuses a size no device asked for', () => {
    // The route is `[size]`, so anything can be requested. Rendering an
    // arbitrary WxH would let a caller ask for a 99999x99999 canvas.
    expect(parseSplashSize('1234x5678')).toBeNull()
  })

  it('refuses input that is not two numbers', () => {
    for (const bad of ['', 'x', '1179', '1179x', 'axb', '1179x2556x1', '-1x-1']) {
      expect(parseSplashSize(bad)).toBeNull()
    }
  })
})
