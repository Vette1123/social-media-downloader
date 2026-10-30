import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { contentProps, EVENTS } from './analytics'
import { prefChanges } from './prefs'

// Every event must have a caller, or the dashboards built on it read zero and
// look like nobody uses the feature. Milestones are fired by track() itself.
const DERIVED = new Set(['first_download', 'first_core_use'])

const SRC = path.resolve(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [full] : []
  })
}

describe('analytics coverage', () => {
  const layer = readFileSync(path.join(SRC, 'lib/analytics.ts'), 'utf8')
  const others = sourceFiles(SRC)
    .filter((file) => !file.endsWith(path.join('lib', 'analytics.ts')))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
    // An import is not a use. A call or a passed callback is.
    .replace(/^import[\s\S]*?from\s+'[^']+'\r?$/gm, '')

  const helpers = [...layer.matchAll(/export function (\w+)\([\s\S]*?\n}\n/g)].map(
    (match) => ({
      name: match[1],
      keys: [...match[0].matchAll(/EVENTS\.(\w+)/g)].map((m) => m[1]),
    }),
  )

  it('every event is sent by a helper that something actually calls', () => {
    const uncalled = Object.entries(EVENTS)
      .filter(([, event]) => !DERIVED.has(event))
      .filter(([key]) => {
        const senders = helpers.filter((helper) => helper.keys.includes(key))
        return !senders.some((helper) =>
          new RegExp(`\\b${helper.name}\\b`).test(others),
        )
      })
      .map(([, event]) => event)
    expect(uncalled).toEqual([])
  })
})

describe('contentProps', () => {
  it('records what was downloaded, without share tokens', () => {
    expect(
      contentProps(
        { title: 'T', author: 'A', platform: 'tiktok', duration: 12, sizeBytes: 2_097_152 },
        'https://www.tiktok.com/@a/video/1?_t=TOKEN',
      ),
    ).toMatchObject({
      platform: 'tiktok',
      content_url: 'https://www.tiktok.com/@a/video/1',
      content_title: 'T',
      content_author: 'A',
      content_type: 'video',
      duration_s: 12,
      size_mb: 2,
    })
  })

  it('tells a gallery from an embed', () => {
    expect(contentProps({ images: [{}, {}] }, null)).toMatchObject({
      content_type: 'images',
      image_count: 2,
    })
    expect(contentProps({ embedUrl: 'x' }, null).content_type).toBe('embed')
  })
})

describe('prefChanges', () => {
  it('reports the key that moved', () => {
    expect(
      prefChanges({ quality: 'hd', format: 'video' }, { quality: 'sd', format: 'video' }),
    ).toEqual([{ key: 'quality', value: 'sd' }])
  })

  it('never sends the text of a filename template', () => {
    expect(
      prefChanges(
        { quality: 'hd', format: 'video' },
        { quality: 'hd', format: 'video', filenameTemplate: '{title} my text' },
      ),
    ).toEqual([{ key: 'filenameTemplate', value: 'custom' }])
  })
})
