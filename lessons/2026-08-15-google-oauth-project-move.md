# The identifier every account hangs on is scoped to a project nobody thought was load-bearing

## What

The site is moving to a different Google Cloud project — new OAuth client, new
client ID and secret, same code. The question asked was whether that breaks
anything. It breaks the accounts table, silently, and the answer is one clause:

- `src/lib/auth/routes.ts` — `handleAuthCallback` re-keys an existing row by
  verified email (`UPDATE users SET google_sub = ? WHERE email = ? AND
  google_sub != ?`) immediately before the upsert that would otherwise have
  created a second row.
- `src/lib/auth/routes.test.ts` — two tests: the re-key runs with the right
  binds, and it runs *before* the INSERT. Both fail without the clause
  (confirmed by stashing the source and re-running, not by reading it).
- `README.md` — the `GOOGLE_CLIENT_ID` row now says what a project move costs
  and that the new project's consent screen has to be published.

Then the obvious follow-on question — *where do the new client's values go* —
had four possible answers, which was three too many. The repo is now down to one
env file:

- `.env` (gitignored) is the only one. `next dev` / `next build` load it,
  `wrangler dev` loads it, and `pnpm cf:setup secrets` uploads the
  deploy-relevant half. `.env.cloudflare`, `.dev.vars` and `.env.local` are
  gone, folded into it.
- `.env.sample` is the only sample; `.env.cloudflare.sample` is deleted.
- `scripts/cf-setup.mjs` reads `.env`, and `isLocalOnly` now also skips
  `NEXT_PUBLIC_*` — build-time values Next has already inlined, which in the
  secret store could only mislead whoever reads the dashboard next.

## Mistakes

- **Read `sub` as a global identifier for a Google account.** It is not. It
  names a person *within one Google Cloud project*: the same human signing in
  through a client in a different project presents a `sub` nobody here has ever
  seen. Every returning user would have arrived as a new user. That is the
  entire finding, and nothing in the code said it — `google_sub TEXT NOT NULL
  UNIQUE` reads exactly like a stable external key, which is what made it worth
  checking rather than assuming.
- **Assumed the damage would announce itself.** `users.email` carries only an
  index (`migrations/0002_users_email_index.sql`), not a UNIQUE constraint, so
  the second row inserts cleanly. No error, no failed sign-in, no log line — the
  visitor signs in successfully and finds an account with no grants, no billing
  columns and no preferences, and the row holding those is still sitting there
  keyed to an identifier that will never be presented again. A schema whose only
  symptom is a working request is worse than one that throws.
- **Nearly answered "just re-apply the grants by hand".** That was the first
  instinct, and it was wrong twice: it scales with the user count, and it has to
  happen *after* each person signs in, because nobody can know their new `sub`
  before they present it. The code path already had the correct join available —
  a verified email address — which is the same proof of ownership the billing
  reconcile has always leaned on.
- **Wrote the second test so it would have passed while broken.** `expect(rekey)
  .toBeLessThan(insert)` is satisfied by `findIndex` returning `-1`. The
  `toBeGreaterThanOrEqual(0)` line above it is what makes the ordering assertion
  mean anything. Caught only because the tests were run against the stashed
  source rather than trusted for passing.

- **Four env files, and one of them had been dead for weeks.** `.env.local` held
  sixteen lines of comments about a Lemon Squeezy key and not one `KEY=` — the
  provider was dropped, the values were deleted, the file was left. Nothing
  reads it, nothing complained, and it still looked authoritative enough to be a
  candidate answer to "where do I put the Google values?". Deleting a credential
  is not the same as deleting the file that explained it.
- **Assumed the split was arbitrary, then found the one place it was not.**
  `.dev.vars` and `.env.cloudflare` both held `BMC_WEBHOOK_SECRET`, and
  `.dev.vars` held a `PRO_TOKEN_SECRET` that is *not* the deployed one — the
  live value was set by hand and is unrecoverable. Merging blindly would have
  made the next `cf:setup secrets` upload the local value and silently rotate
  production's, signing out every user. The merge script was written to let the
  deployed side win on any key present in both, and the surviving conflict is
  called out to the user rather than resolved on their behalf.
- **Reached for `--env-file` before checking whether anything was needed.** The
  first plan added a flag to the `preview` script. Wrangler already falls back
  to `.env` on its own — but only when no `.dev.vars` exists, which is the
  detail that mattered and the reason that file had to be deleted rather than
  merely emptied. The docs said so plainly; the flag would have been noise
  papering over a file that was still silently winning.

## What worked

- Following the identifier instead of the environment variable. The question was
  "does changing a secret affect anything", and every grep hit was a config
  file; the answer was in the column the callback writes, three files away.
- `git stash push -- <one file>` to prove the new tests fail without the change,
  then `git stash pop`. Thirty seconds, and it caught the `-1` bug.
- Leaving the re-key permanently rather than behind a one-off flag. It costs one
  indexed UPDATE per sign-in that matches nothing once the move is done, and a
  migration you have to remember to remove is one you will find still there in a
  year, or removed a week too early.

## Rules

- **A third party's user ID is scoped to something.** Before treating one as a
  primary key, find out what it is stable *relative to* — a project, a tenant,
  an app registration — and write that scope in the schema comment. Google's
  `sub` is per-project; the same trap exists in every provider that lets you
  hold more than one client.
- **Re-key by the verified claim, never by the raw one.** The re-key sits after
  the `email_verified` check on purpose, and moving it above that line turns it
  into account takeover by signup. Any lookup that grants access to an existing
  row on the strength of an email must be downstream of the verification.
- **An assertion built on `findIndex` needs the found-at-all check beside it.**
  `-1` is less than everything.
- **Ask what a config change re-identifies, not just what it re-authenticates.**
  Rotating a secret is invisible to the data model. Replacing the issuer of an
  identity is not.
- **One env file. `.env`, gitignored, `.env.sample` beside it.** Every tool here
  reads it — Next, wrangler, cf-setup — so a value is set once. Never add
  `.dev.vars`: wrangler prefers it and then ignores `.env` entirely, which
  rebuilds the split this removed.
- **Before merging two files that share a key name, ask whether they share the
  value.** Same name, different value, on purpose is the whole reason a split
  survives. Let the side that is harder to recover win, and say out loud which
  key was in conflict.
- **Getting the Google client onto the Worker is two `wrangler secret put`
  commands, never `cf:setup secrets`.** That step pushes every non-blank key in
  `.env`, and `PRO_TOKEN_SECRET` there is not the deployed value — pushing it
  rotates the session-signing key and signs out every user. One key at a time
  cannot do that. The shortcut is only safe once the two `PRO_TOKEN_SECRET`
  values have been deliberately made identical.
