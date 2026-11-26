/**
 * Read POST /api/download's answer. The route always answers JSON, but a WAF
 * challenge or an edge error page in front of it answers HTML, and
 * `response.json()` on that throws "Unexpected token '<'": a message that names
 * nothing and is filed as our fault. This names the status instead, so
 * `failureCode` can tell a challenge (403, unavailable) from a crash (5xx, ours).
 */
export async function readResolveAnswer<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    const err = new Error(
      `The server answered HTTP ${response.status} instead of a result. Please try again.`,
    ) as Error & { response?: { status: number } }
    err.response = { status: response.status }
    throw err
  }
}
