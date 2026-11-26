# Two failures that named nothing: an HTML resolve answer and a host's HTTP 470

## What

The 26 Nov sweep found the only two open PostHog issues:

- `[resolve:linkedin] Unexpected token '<', "<!DOCTYPE "... is not valid JSON` (1 person).
  `resolve.ts` called `response.json()` on whatever `/api/download` answered. An HTML page (a
  WAF challenge or an edge error page) threw a parse error that carried no status, so
  `failureCode` filed it `upstream`, our fault, with nothing to trace. `readResolveAnswer`
  (`src/lib/resolveAnswer.ts`) now parses the text and, on a non-JSON body, throws
  `HTTP <status>`. A 403 challenge reads as `unavailable`, an HTML 5xx stays `server`.
- `[download:video] HTTP 470` (1 iOS visitor, 2 events, generic host). 470 is not a code we send:
  the media host refused the transfer. No rule matched it, so it fell to `upstream`. Statuses
  outside the standard 4xx set (432-450, 452-499) now read as `unavailable`; standard 4xx
  (400, 405) stay ours.

## Mistakes

- The first `readResolveAnswer` gated on the `content-type` header. 13 resolve tests failed
  because their mocks (`new Response(string)`) carry `text/plain`. A header is a weaker
  signal than the body itself: parse, and fall back on failure.

## What worked

- Pulling the session's own events (`resolve_succeeded` → `download_started` → `api_error`)
  showed the 470 came after a good resolve, on the media fetch, so it was the host, not us.

## Rules

- A client `response.json()` on one of our routes goes through a reader that survives a
  non-JSON page and names the status.
- Non-standard 4xx from a host is a refusal, not a fault; pinned in `analyticsErrors.test.ts`.
