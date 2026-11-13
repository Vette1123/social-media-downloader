/**
 * The static export served the way production serves it: Brotli for text, and
 * immutable caching on hashed `_next` assets. Shared by `pnpm perf` and
 * `pnpm cls`, because `next start` cannot serve an `output: 'export'` build.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

export const OUT_DIR = 'out'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml'])

function resolveFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^[\\/]+/, '')
  return [clean, join(clean, 'index.html'), `${clean}.html`]
    .map((candidate) => join(OUT_DIR, candidate))
    .find((file) => existsSync(file) && statSync(file).isFile())
}

export function serve() {
  const compressed = new Map()
  const server = createServer((req, res) => {
    const file = resolveFile(new URL(req.url, 'http://x').pathname)
    if (!file) {
      res.writeHead(404, { 'content-type': MIME['.html'] })
      res.end(readFileSync(join(OUT_DIR, '404.html')))
      return
    }
    const ext = extname(file)
    const headers = { 'content-type': MIME[ext] ?? 'application/octet-stream' }
    if (file.includes('_next')) headers['cache-control'] = 'public, max-age=31536000, immutable'
    let body = readFileSync(file)
    if (COMPRESSIBLE.has(ext)) {
      if (!compressed.has(file)) {
        compressed.set(
          file,
          brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
        )
      }
      body = compressed.get(file)
      headers['content-encoding'] = 'br'
    }
    res.writeHead(200, headers)
    res.end(body)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}
