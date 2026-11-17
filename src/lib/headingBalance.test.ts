import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Every .tsx under src, recursively. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

// A page heading that wraps unbalanced strands its last word ("run." alone
// under "Free forever. Not free to", /pro on a phone, 17 Nov). Every <h1>
// balances its lines, directly or through a shared class constant.
describe('page headings', () => {
  it('every <h1> balances its lines', () => {
    const unbalanced: string[] = []
    for (const file of tsxFiles(join(process.cwd(), 'src'))) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/<h1\b[^>]*>/g)) {
        if (!/text-balance|PAGE_H1/.test(match[0])) {
          unbalanced.push(`${file.slice(process.cwd().length + 1)}: ${match[0]}`)
        }
      }
    }
    expect(unbalanced).toEqual([])
  })
})
