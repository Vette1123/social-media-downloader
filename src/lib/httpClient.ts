/**
 * Shared HTTP client for all server-side extractor traffic.
 *
 * This is a small native-`fetch` client presenting the slice of the axios API
 * the extractors actually use. It replaced axios itself for one measured
 * reason: on workerd, axios costs real CPU against a 10 ms per-request budget.
 *
 * Benchmarked on a deployed Worker (the only way to get a trustworthy number —
 * workerd clamps Date.now()/performance.now() so a Worker cannot time itself,
 * leaving `cpuTime` from the tail stream as the sole honest signal):
 *
 *     5x POST + JSON.parse via native fetch  ->  2 ms CPU
 *     5x the same request via axios          ->  9 ms CPU (p90 12 ms)
 *
 * That is ~1.5-2 ms per upstream call, and a single resolve makes two or three.
 * Axios was roughly half the CPU of /api/download, and the 10 ms ceiling was
 * being brushed on cache misses. None of that cost buys us anything here: the
 * adapter was already pinned to `fetch`, so axios was a config-merging,
 * header-normalising, interceptor-dispatching wrapper over the same call.
 *
 * Dropping it also removes the dependency from the Worker bundle entirely,
 * which shortens isolate startup.
 *
 * The surface is deliberately axios-shaped rather than idiomatic-fetch-shaped,
 * so the ~21 extractor call sites did not each need rewriting (and re-testing
 * against live third-party services). Behaviours reproduced on purpose:
 *
 *   - `.data` is auto-parsed: JSON for a JSON content-type, otherwise the raw
 *     text, or an ArrayBuffer when `responseType: 'arraybuffer'`.
 *   - Non-2xx THROWS, and the thrown error carries `.response.status` — unless
 *     `validateStatus` says otherwise. Several call sites pass
 *     `validateStatus: () => true` and check `.status` by hand.
 *   - Network/timeout failures throw WITHOUT a `.response`, because
 *     `isTransientError` in downloader.ts distinguishes the two that way.
 *   - `.headers` supports dictionary access, and `set-cookie` comes back as an
 *     array (Instagram's CSRF bootstrap reads it).
 *   - `.request.res.responseUrl` exposes the post-redirect URL, which the
 *     TikTok/Facebook short-link resolvers use.
 */

export interface HttpRequestConfig {
  headers?: Record<string, string>
  /** Milliseconds. Aborts the request; the error reports code ECONNABORTED. */
  timeout?: number
  /** Only 'arraybuffer' is honoured; anything else falls back to auto-detect. */
  responseType?: 'arraybuffer' | 'json' | 'text'
  /**
   * Accepted for call-site compatibility. `fetch` follows redirects natively
   * and does not expose a hop limit, so the number itself is advisory.
   */
  maxRedirects?: number
  /** Return true to accept a status instead of throwing. */
  validateStatus?: (status: number) => boolean
}

/**
 * Default type of a response body, mirroring axios's own `AxiosResponse<T = any>`.
 *
 * Deliberate, not laziness: every `data` here is an untyped JSON blob from a
 * third-party service that can change shape without notice, and the call sites
 * already guard with optional chaining and `typeof` checks. Defaulting to
 * `unknown` instead would force a cast at all ~21 of them, which buys no real
 * safety — a cast asserts a shape nobody verified — while making the diff that
 * removed axios far larger than it needs to be.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseData = any

export interface HttpResponse<T = ResponseData> {
  data: T
  status: number
  statusText: string
  headers: HttpHeaders
  /** axios-shaped, purely so `.request.res.responseUrl` keeps working. */
  request: { res: { responseUrl: string } }
}

/**
 * Header bag with both dictionary access (`headers['set-cookie']`) and the
 * `Headers.get()` method, since call sites use both spellings.
 */
type HttpHeaders = Record<string, string | string[]> & {
  get(name: string): string | null
}

export interface HttpError extends Error {
  /** Present only for an HTTP-status failure — absent for network/timeout. */
  response?: { status: number; statusText: string; data: unknown }
  /** axios-compatible: ECONNABORTED on timeout. */
  code?: string
}

const JSON_TYPE = /^application\/(?:[\w.+-]+\+)?json\b|^text\/json\b/i

function defaultValidateStatus(status: number): boolean {
  return status >= 200 && status < 300
}

function toHeaderBag(headers: Headers): HttpHeaders {
  const bag: Record<string, string | string[]> = {}
  headers.forEach((value, key) => {
    bag[key] = value
  })
  // Multiple Set-Cookie headers collapse to one comma-joined string in the
  // forEach above, which is ambiguous (cookie values may contain commas).
  // getSetCookie preserves them as distinct entries.
  const setCookie = headers.getSetCookie?.()
  if (setCookie && setCookie.length > 0) bag['set-cookie'] = setCookie

  return Object.assign(bag, {
    get: (name: string) => headers.get(name),
  }) as HttpHeaders
}

/**
 * Mirrors axios's transformResponse: parse by declared content-type, but fall
 * back to raw text if the body does not actually parse — several of these hosts
 * label an HTML error page as JSON.
 */
async function readBody(
  response: Response,
  responseType: HttpRequestConfig['responseType'],
): Promise<unknown> {
  if (responseType === 'arraybuffer') return response.arrayBuffer()

  const text = await response.text()
  if (responseType === 'text') return text

  const contentType = response.headers.get('content-type') || ''
  if (responseType === 'json' || JSON_TYPE.test(contentType)) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

async function request<T>(
  method: 'GET' | 'POST' | 'HEAD',
  url: string,
  body: unknown,
  config: HttpRequestConfig = {},
): Promise<HttpResponse<T>> {
  const headers: Record<string, string> = { ...config.headers }

  // Plain objects are JSON — axios did this implicitly and several call sites
  // rely on it. Strings, URLSearchParams and streams are passed through as-is
  // (those call sites set Content-Type themselves).
  let payload: BodyInit | undefined
  if (body !== undefined && body !== null) {
    const isPlainObject =
      typeof body === 'object' &&
      !(body instanceof URLSearchParams) &&
      !(body instanceof FormData) &&
      !(body instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(body)

    if (isPlainObject) {
      payload = JSON.stringify(body)
      const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === 'content-type',
      )
      if (!hasContentType) headers['Content-Type'] = 'application/json'
    } else {
      payload = body as BodyInit
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: payload,
      redirect: 'follow',
      // AbortSignal.timeout covers the whole exchange, where axios's `timeout`
      // covered the socket. Strictly the safer of the two for a Worker, which
      // is billed on wall-clock subrequest duration.
      signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
    })
  } catch (cause) {
    // No `.response` here on purpose — isTransientError treats a missing
    // response as a network-layer failure and retries it.
    const error = new Error(
      isAbort(cause) ? `timeout of ${config.timeout}ms exceeded` : String(cause),
    ) as HttpError
    error.code = isAbort(cause) ? 'ECONNABORTED' : 'ECONNRESET'
    throw error
  }

  const validate = config.validateStatus ?? defaultValidateStatus
  // HEAD has no body to read, and calling .text() on one is a needless await.
  const data = (method === 'HEAD' ? null : await readBody(response, config.responseType)) as T

  if (!validate(response.status)) {
    const error = new Error(
      `Request failed with status code ${response.status}`,
    ) as HttpError
    error.response = {
      status: response.status,
      statusText: response.statusText,
      data,
    }
    throw error
  }

  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: toHeaderBag(response.headers),
    // `response.url` is the URL after redirects, which is exactly what the
    // short-link resolvers want out of this field.
    request: { res: { responseUrl: response.url || url } },
  }
}

export const http = {
  get<T = ResponseData>(url: string, config?: HttpRequestConfig) {
    return request<T>('GET', url, undefined, config)
  },
  post<T = ResponseData>(url: string, body?: unknown, config?: HttpRequestConfig) {
    return request<T>('POST', url, body, config)
  },
  head<T = ResponseData>(url: string, config?: HttpRequestConfig) {
    return request<T>('HEAD', url, undefined, config)
  },
}
