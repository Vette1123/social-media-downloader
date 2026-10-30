import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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
})
