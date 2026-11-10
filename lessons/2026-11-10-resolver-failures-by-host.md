# Resolver failures: name the host, accept the link inside the text

## What
PostHog showed 188 generic, 86 Instagram rate-limit, 85 Facebook and 44 "Invalid URL" resolve failures in a week. `resolve_failed` carried no site, so the biggest bucket (generic) could not be acted on. Added a privacy-safe `host` (registrable domain only) to `link_submitted`, `link_rejected` and `resolve_failed`; made the parser take a link out of shared text or with no scheme; made `pin.it` links reach the Pinterest extractor; stopped the generic catch-all blaming the post.

## Mistakes
- `detectPlatform` is anchored, so "Look at this https://x.com/..." answered "Invalid URL" for a fine link. Only the multi-URL paste path and the paste handlers extracted a URL first; the typed field and the API did not.
- `tryPinterestPin` read the pin id from the URL, so a `pin.it` short link (recognised as Pinterest) skipped the only pin extractor and depended on Cobalt.
- The privacy sentence is translated in four locale files plus `en.lock.json`; editing the English alone fails `localeContent.test.ts`. A single quote inside the single-quoted copy string also broke parsing.
- Production probe `instagram /p/CmUv48DLvxd/` is red because the post is gone (embed 404), not because the extractor broke. Reddit is the known CF-egress wall.
- This worktree checks out CRLF, so `analytics.test.ts` (regex on `\n}\n`) and `localeContent.test.ts` (shebang with `\r`) fail here and pass in the LF main checkout.

## What worked
- `pnpm cf:smoke --only platform` against production tells extractor-broken from post-gone in one minute.
- One pure `extractLink` in validator.ts used by the server route and the client field.

## Rules
- Every failure event names the site (`host`) but never a path or query.
- A catch-all error says "unsupported site" for generic links; "private" is only a fair guess for a named platform.
- A copy change on the privacy page touches `legalCopy.ts`, the locale JSONs and `pnpm i18n:lock` in the same commit.
