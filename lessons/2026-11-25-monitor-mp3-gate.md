# The platform monitor asserts the supporter gate

## What

The daily Platform monitor went red on 2026-11-24. The check `api/download resolves YouTube
audio` expected a 200 and got a 403. That 403 was the supporter gate (#91) doing what it was
built to do: the probe has no supporter token, and YouTube MP3 has been for supporters since
2026-11-23. The check now expects the anonymous refusal (403, `success: false`, the
"supporter feature" message). It is no longer `thirdParty`, because the gate answers before
any extractor runs.

The same sweep found one open PostHog issue, `[resolve:youtube] MP3 from YouTube is a
supporter feature.`, with 2 events on 24 Nov. Its fingerprint was `resolve:youtube:upstream`,
which means the client that sent it had no `supporter` rule. Its stack chunks
(`2hsyrmygftqp8.js`, `1xh4ofu35jdss.js`) are no longer served, so this was a tab open on a
pre-#91 bundle. The issue was resolved in PostHog with that note. No code change was needed.

## Mistakes

- #91 changed what anonymous callers get from `/api/download` and did not touch
  `cf-smoke.mjs`. The post-deploy smoke run treats `thirdParty` checks as advisory, so the
  deploy stayed green. Only the strict daily monitor caught the change, a day later.
- A sweep test timeout (`hoverStyles.test.ts`, 10.9 s) looked like a flaky test. It came
  from running this suite at the same time as Reely's. Alone, it passed 147/147 twice.
  Never run two repos' `pnpm test` at once.

## What worked

- Red/green against production with `--only "YouTube audio"` and `SMOKE_STRICT=1`: main's
  copy fails ("expected 200, got 403") and the fix passes.
- The `$exception_fingerprint` suffix names the code the client chose. `:upstream` on a
  message the live rules classify as expected means a stale bundle, not a bad rule.

## Rules

- A change to what a route returns to an anonymous caller updates `scripts/cf-smoke.mjs` in
  the same PR.
- A check that only exercises our own code is never `thirdParty`. That flag makes a failure
  advisory after a deploy.
