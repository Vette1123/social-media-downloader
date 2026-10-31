import { describe, expect, it } from 'vitest'
import { parseFbCookie } from './fb-cookie.mjs'

describe('parseFbCookie', () => {
  it('keeps a pasted header, skipping the file comments and the header name', () => {
    const pasted = '# paste below\r\nCookie: c_user=1; xs=2%3Aa=b; datr=3\r\n'
    expect(parseFbCookie(pasted)).toEqual({
      header: 'c_user=1; xs=2%3Aa=b; datr=3',
      names: ['c_user', 'xs', 'datr'],
    })
  })

  it('reads the DevTools Application table', () => {
    const row = (name, value) =>
      `${name}\t${value}\t.facebook.com\t/\t2027-10-31T08:04:47.975Z\t20\t\t✓\tNone\t\t\tMedium`
    const pasted = `# paste below\n${row('c_user', '1')}\n${row('xs', '2%3Aa')}\n`
    expect(parseFbCookie(pasted)).toEqual({
      header: 'c_user=1; xs=2%3Aa',
      names: ['c_user', 'xs'],
    })
  })

  it('refuses an empty paste', () => {
    expect(() => parseFbCookie('# paste below\n')).toThrow(/missing c_user and xs/)
  })

  it('names what is missing without printing any value', () => {
    let message = ''
    try {
      parseFbCookie('c_user=SECRETVALUE; xs=; datr=OTHERSECRET')
    } catch (e) {
      message = e.message
    }
    expect(message).toContain('missing xs')
    expect(message).not.toContain('SECRETVALUE')
    expect(message).not.toContain('OTHERSECRET')
  })

  it('never prints a paste it could not split into names', () => {
    let message = ''
    try {
      parseFbCookie('c_user SECRETVALUE .facebook.com / xs ANOTHERSECRET')
    } catch (e) {
      message = e.message
    }
    expect(message).toContain('missing c_user and xs')
    expect(message).not.toContain('SECRETVALUE')
    expect(message).not.toContain('ANOTHERSECRET')
  })
})
