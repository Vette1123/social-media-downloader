import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('install prompt placement', () => {
  it('portals past the paste bar, so arriving after paint moves nothing', () => {
    const source = readFileSync('src/components/InstallPrompt.tsx', 'utf8')
    const hero = readFileSync('src/components/DevAppLinks.tsx', 'utf8')

    expect(source).toContain('createPortal(')
    expect(source).toContain('getElementById(INSTALL_SLOT_ID)')
    expect(hero).toContain('id={INSTALL_SLOT_ID}')
  })

  it('never floats on a phone, where it would cover the paste bar', () => {
    const source = readFileSync('src/components/InstallPrompt.tsx', 'utf8')

    expect(source).not.toMatch(/className='[^']*(?<!sm:)\bfixed\b/)
    expect(source).toContain('sm:fixed')
  })
})
