/**
 * Upstream media fetch with a Node fallback for Cloudflare's header-case
 * challenge.
 *
 * Some Cloudflare-fronted media CDNs answer `403` + `cf-mitigated: challenge`
 * to a request whose header names are lowercase, and `206 video/mp4` to the
 * same request with `User-Agent`/`Referer` capitalized. Both undici's `fetch` and the
 * WHATWG `Headers` class lowercase every name before sending, so the caller
 * cannot avoid it; the same values sent through `curl` or Node's `https`
 * module — which preserve the case they are given — are served.
 *
 * This matters because the media proxy is the only path that can attach the
 * Referer these hosts demand, so a challenge here makes an otherwise
 * extractable video undownloadable.
 *
 * The fallback is Node-only by construction: workerd has no `node:https`, and
 * its `fetch` is not challenged. `process.getBuiltinModule` is used rather
 * than an import so the Cloudflare bundle never contains (or resolves) a Node
 * built-in.
 */

const CHALLENGE_STATUS = 403
const MAX_REDIRECTS = 5

type NodeHttps = typeof import('node:https')
type NodeHttp = typeof import('node:http')
type NodeStream = typeof import('node:stream')

function builtin<T>(name: string): T | null {
  const get = (process as NodeJS.Process & {
    getBuiltinModule?: (id: string) => unknown
  }).getBuiltinModule
  if (typeof get !== 'function') return null
  try {
    return (get.call(process, name) as T | undefined) ?? null
  } catch {
    return null
  }
}

type HeaderEntry = [string, string]

/**
 * Header names with their original case, because that case is load-bearing
 * here: Cloudflare answers `403 cf-mitigated: challenge` to a request carrying
 * `user-agent`/`referer` in lowercase and `206` to the same request with
 * `User-Agent`/`Referer`. `Headers` normalizes every name to lowercase, so it
 * cannot be used to build the fallback request — the object the caller passed
 * has to be read directly.
 *
 * A `Headers` instance has already lost the case; those names are title-cased
 * as the best available approximation.
 */
function headerEntries(headers: HeadersInit | undefined): HeaderEntry[] {
  if (!headers) return []
  if (headers instanceof Headers) {
    const out: HeaderEntry[] = []
    headers.forEach((value, key) => out.push([canonicalHeaderName(key), value]))
    return out
  }
  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => [key, value])
  }
  return Object.entries(headers).map(([key, value]) => [key, String(value)])
}

function canonicalHeaderName(name: string): string {
  return name.replace(/(^|-)([a-z])/g, (_, separator: string, letter: string) =>
    separator + letter.toUpperCase(),
  )
}

/** True when the Node `https`/`http` fallback can run in this runtime. */
export function nodeMediaFetchAvailable(): boolean {
  if (process.env.DEPLOY_TARGET === 'cloudflare') return false
  return builtin<NodeHttps>('node:https') !== null
}

/**
 * A Cloudflare challenge is a 403 carrying `cf-mitigated: challenge`. The
 * header is what makes this safe to special-case: a normal 403 (an expired
 * signed URL, a hotlink block we failed to satisfy) must pass through
 * untouched rather than trigger a second request.
 */
export function isCloudflareChallenge(response: Response): boolean {
  return (
    response.status === CHALLENGE_STATUS &&
    response.headers.get('cf-mitigated') === 'challenge'
  )
}

/** A status whose Response must not carry a body, or the constructor throws. */
function isBodylessStatus(status: number): boolean {
  return status === 204 || status === 304
}

/**
 * Headers that describe this one connection rather than the resource. curl and
 * Node hand them over as ordinary response headers, but a `Response` is
 * connection-agnostic and the consumer writes its own framing, so forwarding
 * them would double-describe the body.
 */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function isHopByHop(name: string): boolean {
  return HOP_BY_HOP_HEADERS.has(name.toLowerCase())
}

/**
 * `fetch`, but a challenge is retried through `curl` and then Node's `https`
 * stack, both of which keep the header-name case the caller passed.
 *
 * Everything else — success, a real 4xx, a 5xx, a network error — is returned
 * or thrown exactly as `fetch` produced it, so callers keep their existing
 * retry and error handling.
 */
export async function fetchWithNodeFallback(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init)
  if (!isCloudflareChallenge(response) || !nodeMediaFetchAvailable()) {
    return response
  }
  await response.body?.cancel().catch(() => {})

  // curl first: it preserves the header-name case and streams the body, and it
  // was measured passing where both undici and Node's `https` got the
  // challenge. It also honours Range, which is what the media proxy needs.
  try {
    const viaCurl = await curlFetch(url, init)
    if (!isCloudflareChallenge(viaCurl)) return viaCurl
    await viaCurl.body?.cancel().catch(() => {})
  } catch {
    // No curl on this host, or it failed to start. Fall through.
  }

  try {
    return await nodeFetch(url, init)
  } catch {
    // Keep the caller's error path honest: this is still the origin declining,
    // not a failure of ours to report as a 500.
    return new Response(null, {
      status: CHALLENGE_STATUS,
      headers: { 'cf-mitigated': 'challenge' },
    })
  }
}

/**
 * Fetch through the `curl` binary. Only ever reached on a Node host after a
 * challenge, so the process cost is paid by the rare host that needs it.
 *
 * `-D -` puts the response headers on stdout ahead of the body, which is the
 * only way to learn the status without buffering the file. Redirect blocks are
 * skipped while parsing; the first non-3xx block is the real response.
 */
function curlFetch(url: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const childProcess = builtin<typeof import('node:child_process')>(
      'node:child_process',
    )
    const stream = builtin<NodeStream>('node:stream')
    if (!childProcess || !stream) {
      reject(new Error('Node child_process is unavailable'))
      return
    }

    const args = [
      '-sS',
      '-g',
      '-L',
      // The URL is user-supplied: never let it, or a redirect, reach file://,
      // ftp:// or any other scheme curl would otherwise speak.
      '--proto',
      '=http,https',
      '--proto-redir',
      '=http,https',
      '--max-redirs',
      String(MAX_REDIRECTS),
      '--connect-timeout',
      '10',
      '-D',
      '-',
      '-o',
      '-',
    ]
    if (init?.method && init.method !== 'GET') {
      args.push('-X', init.method)
    }
    for (const [key, value] of headerEntries(init?.headers)) {
      args.push('-H', `${key}: ${value}`)
    }
    args.push(url)

    const child = childProcess.spawn('curl', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let headerBuffer = Buffer.alloc(0)
    let settled = false
    let bodyController: ReadableStreamDefaultController<Uint8Array> | null = null
    let paused = false
    let aborted = false
    let stderr = ''

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        bodyController = controller
      },
      pull() {
        if (!paused) return
        paused = false
        child.stdout?.resume()
      },
      cancel() {
        child.kill()
      },
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString('utf8')
    })

    child.stdout?.on('data', (chunk: Buffer) => {
      if (settled) {
        try {
          bodyController?.enqueue(chunk)
          // Match the consumer's pace instead of buffering a whole video in
          // the isolate: pause curl until the stream asks for more.
          if ((bodyController?.desiredSize ?? 1) <= 0) {
            paused = true
            child.stdout?.pause()
          }
        } catch {
          // The consumer went away; curl will be killed by cancel().
        }
        return
      }

      headerBuffer = Buffer.concat([headerBuffer, chunk])
      const parsed = parseCurlResponse(headerBuffer)
      if (!parsed) return

      settled = true
      const bodyless = isBodylessStatus(parsed.status)
      if (!bodyless && parsed.body.length > 0) {
        bodyController?.enqueue(parsed.body)
        if ((bodyController?.desiredSize ?? 1) <= 0) {
          paused = true
          child.stdout?.pause()
        }
      }
      try {
        resolve(
          new Response(bodyless ? null : body, {
            status: parsed.status,
            headers: parsed.headers,
          }),
        )
      } catch (error) {
        // A malformed status or header from curl is not something the caller
        // can act on; surface it as a failed fetch so the next fallback runs.
        child.kill()
        reject(error)
      }
    })

    child.on('error', (error) => {
      if (!settled) reject(error)
    })

    child.on('close', (code) => {
      if (!settled) {
        reject(
          new Error(
            `curl exited with ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
          ),
        )
        return
      }
      try {
        // A non-zero exit after the headers means the transfer stopped early.
        // Closing the stream would make the truncated file look complete, so
        // report it as a failed body instead.
        if (aborted || code !== 0) {
          bodyController?.error(
            new Error(
              `curl exited with ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
            ),
          )
        } else {
          bodyController?.close()
        }
      } catch {
        // Already closed or cancelled.
      }
    })

    const signal = init?.signal
    if (signal) {
      if (signal.aborted) {
        aborted = true
        child.kill()
        return
      }
      const onAbort = () => {
        aborted = true
        child.kill()
      }
      signal.addEventListener('abort', onAbort, { once: true })
      child.on('close', () => signal.removeEventListener('abort', onAbort))
    }
  })
}

interface ParsedCurlResponse {
  status: number
  headers: Headers
  body: Buffer
}

/**
 * The final header block in curl's `-D -` output, plus whatever body bytes
 * arrived in the same chunk. Returns null until a complete block is buffered.
 */
function parseCurlResponse(buffer: Buffer): ParsedCurlResponse | null {
  let offset = 0
  // A bounded loop: redirect chains are capped, and a malformed stream must
  // not spin. Each pass consumes one header block.
  for (let block = 0; block < MAX_REDIRECTS + 2; block++) {
    const end = buffer.indexOf('\r\n\r\n', offset)
    if (end === -1) return null

    const lines = buffer.subarray(offset, end).toString('latin1').split('\r\n')
    const status = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(lines[0] ?? '')
    if (!status) return null

    const headers = new Headers()
    for (const line of lines.slice(1)) {
      const colon = line.indexOf(':')
      if (colon <= 0) continue
      const name = line.slice(0, colon).trim()
      if (isHopByHop(name)) continue
      headers.append(name, line.slice(colon + 1).trim())
    }

    offset = end + 4
    const code = Number(status[1])
    // 1xx and a redirect curl is following are not the answer.
    if (code >= 100 && code < 200) continue
    if (code >= 300 && code < 400 && headers.get('location')) continue

    return { status: code, headers, body: buffer.subarray(offset) }
  }
  return null
}

async function nodeFetch(url: string, init?: RequestInit): Promise<Response> {
  let target = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await nodeRequest(target, init)
    const location = response.headers.get('location')
    if (
      response.status >= 300 &&
      response.status < 400 &&
      location
    ) {
      await response.body?.cancel().catch(() => {})
      target = new URL(location, target).toString()
      continue
    }
    return response
  }
  throw new Error('Too many redirects')
}

function nodeRequest(url: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      reject(new Error(`Invalid URL: ${url}`))
      return
    }

    const secure = parsed.protocol === 'https:'
    const http = builtin<NodeHttps | NodeHttp>(
      secure ? 'node:https' : 'node:http',
    )
    const stream = builtin<NodeStream>('node:stream')
    if (!http || !stream) {
      reject(new Error('Node HTTP is unavailable'))
      return
    }

    const headers: Record<string, string> = {}
    for (const [key, value] of headerEntries(init?.headers)) {
      headers[key] = value
    }

    const request = http.request(
      {
        method: init?.method ?? 'GET',
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        headers,
      },
      (response) => {
        const responseHeaders = new Headers()
        for (const [key, value] of Object.entries(response.headers)) {
          if (isHopByHop(key)) continue
          if (Array.isArray(value)) {
            for (const entry of value) responseHeaders.append(key, entry)
          } else if (value !== undefined) {
            responseHeaders.set(key, value)
          }
        }

        const status = response.statusCode ?? 502
        // A 204/304 must not carry a body, and constructing a Response with
        // one throws. Media is 200/206, but a conditional request can 304.
        const body = isBodylessStatus(status)
          ? null
          : (stream.Readable.toWeb(response) as ReadableStream<Uint8Array>)

        try {
          resolve(
            new Response(body, {
              status,
              statusText: response.statusMessage,
              headers: responseHeaders,
            }),
          )
        } catch (error) {
          response.destroy()
          reject(error)
        }
      },
    )

    request.on('error', reject)

    const signal = init?.signal
    if (signal) {
      if (signal.aborted) {
        request.destroy(new Error('Aborted'))
        return
      }
      const onAbort = () => request.destroy(new Error('Aborted'))
      signal.addEventListener('abort', onAbort, { once: true })
      request.on('close', () => signal.removeEventListener('abort', onAbort))
    }

    request.end()
  })
}
