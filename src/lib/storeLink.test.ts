import { afterEach, describe, expect, it, vi } from 'vitest'
import { onStoreLinkClick, openStoreListing, PLAY_APPS } from './apps'

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
const app = PLAY_APPS[0]

function browser(userAgent: string, open: unknown) {
  const location = { href: '' }
  vi.stubGlobal('window', {
    navigator: { userAgent },
    location,
    open: vi.fn(() => open),
  })
  return location
}

afterEach(() => vi.unstubAllGlobals())

describe('store links', () => {
  it('leave a Mac click to the anchor, which no popup blocker can stop', () => {
    browser(MAC, null)
    const event = { preventDefault: vi.fn() }
    onStoreLinkClick(event, app)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('take over on a phone, to reach the right store', () => {
    browser(IPHONE, {})
    const event = { preventDefault: vi.fn() }
    onStoreLinkClick(event, app)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith(app.appStoreUrl, '_blank')
  })

  it('fall back to this tab when a popup is blocked', () => {
    const location = browser(MAC, null)
    openStoreListing(app)
    expect(location.href).toBe(app.installUrl)
  })
})
