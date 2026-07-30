import axios from 'axios'

/**
 * Shared axios instance for all server-side extractor traffic.
 *
 * The adapter is pinned to `fetch` rather than left to axios's auto-detection.
 * Axios picks its adapter by feature-detecting the runtime: it looks for
 * XMLHttpRequest (browser), then falls back to the Node `http` adapter. On
 * Cloudflare Workers neither is the right answer — `nodejs_compat` exposes
 * enough of `process` and `node:http` for the detection to choose the Node
 * adapter, which then fails at request time against workerd's partial
 * implementation. `fetch` is native on workerd and fully supported on Node 18+,
 * so pinning it makes the same code path run identically on both.
 *
 * Note the one behavioural constraint this imposes: the fetch adapter cannot
 * produce `responseType: 'stream'` (that returns a Node Readable, which does not
 * exist on workerd). Streaming reads use native `fetch` + a web ReadableStream
 * directly instead — see `verifyStreamReachable` in downloader.ts.
 */
export const http = axios.create({
  adapter: 'fetch',
})
