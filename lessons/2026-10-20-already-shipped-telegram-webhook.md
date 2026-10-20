# The features I pitched were already on the ship

**Date:** 2026-10-20
**Scope:** `src/lib/telegram.ts`, `src/lib/directSave.ts`, `src/lib/apiRoutes.ts`, `src/app/api/telegram/route.ts`

## What

Growth brief answered with a ranked list of attracting features: platform recipes, auto-paste, transcripts, Telegram. Before building anything, the codebase map showed three of the four heavier ideas already exist and are tested — Reddit/Twitch/Pinterest recipes wired into `downloadGeneric` ahead of Cobalt with their own suite, paste-anywhere plus clipboard-watch plus a paste chip in the client, and `llms.txt` shipped from a static route. Probing them live from this machine: Pinterest resolved in ~400ms, Twitch GQL returned a fully-formed clip, and only Reddit's own JSON listing was unfetchable from here (403), which supports the recipe's own comment — Reddit refuses our egress, the embed is the working path. The new build was therefore exactly one thing: the Telegram webhook bot — `handleTelegram` resolves a pasted link through the same `Downloader` chain and answers with a save button; no token configured means `enabled:false` and an unconditional 200, because Telegram retries any non-2xx forever.

## Mistakes

**I built the webhook to import `directSaveUrl` from `apiRoutes`, making the cycle the file header itself warns against.** The repo's own guard test (`importCycles.test.ts` — which I had not read) caught it: `apiRoutes → telegram → apiRoutes` wraps the whole route table in init closures at isolate boot. Fix: `directSaveUrl`/`asDirectTunnel` moved into the leaf `src/lib/directSave.ts`, apiRoutes imports and re-exports, telegram imports the leaf only. The guard test is the import linting this repo needs — read it before touching the route graph.

**My own stub answered "blocks automated requests from our servers."** I pointed the webhook test at a generic URL and faked every fetch with one og:video HTML — the downloader's bot-wall detection classified that HTML stream as a wall and threw before pageScrape, then a Vimeo URL resolved as an embed-only result the webhook cannot hand over, both sending the test down timeouts. The webhook test's job is the webhook; mocking `./downloader` at the module boundary makes the resolver a deterministic stand-in instead of a second, accidentally-under-tested system.

**A comma-expression return pixel.** `return new URL(...).toString(), null` returned null every time — the kind of thing the type checker cannot catch because the comma operator is legal. It shipped for one Save call only because the button test was watching for it; keep compound-expression returns out of branches.

## What worked

- **Map before build.** One explore pass converted four build items into one and saved roughly three builds of code that already existed, tested, behind better comments than I would have written.
- **The repo guards itself.** `importCycles.test.ts` failing red was the fastest possible answer to a mistake the design docs already warn about, without any of it being re-explained to me.

## Rules

- Pitch a feature list against the map first; the pitch that survives is the one whose names match nothing in the tree.
- When the repo has a guard test for a class of mistake, that test is the design doc — read it before the next graph-level change.
- A webhook integration test mocks its upstream at the boundary; never let it re-run the resolver chain.
