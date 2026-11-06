# Support by email after the payment provider was suspended

## What

The old payment provider suspended the account on 2026-11-06. Both `/pro`
buttons now open `proMailto()` (`src/config/support.ts`) addressed to
`PRO_EMAIL`, with the plan in the subject. The owner replies with how to pay and
runs `pnpm pro <address>` (new, ported from Reely's `scripts/grant-pro.mjs`).
The webhook and its tests, the floating widget and its CSS, the provider links,
the robot UA allowlist, the secret and the setup doc are gone, and the copy is
rewritten in all five languages. `claimSupporterGrants` moved to
`src/lib/billing/supporters.ts`, so the one existing supporter keeps the extras
(checked: `supporters` still holds 1 active row). The Creem webhook and the
shared `hmacWebhook.ts` stay.

## Mistakes

- Deleting `.github/FUNDING.yml` outright also dropped the GitHub Sponsors line.
  It was restored with just that line. Read a file before deleting it as
  "the provider's".
- Two tests failed only in the fresh worktree: `core.autocrlf=true` checked the
  files out with CRLF, and a CRLF shebang breaks vite's import of
  `scripts/i18n-deep.mjs`. `analytics.test.ts` also parses with a `\n}\n` regex.
  Main's working copy is LF, so these passed there. Converting the working copy
  to LF (git sees no diff) fixed both. Before editing, compare a red test against
  main.
- A subagent launched from inside the Reely worktree session was pinned to it
  and could not run a shell here. This repo was done by hand afterwards.

## What worked

Applying every translation from one spec file (path → five languages, plus the
`d()` keys renamed in place) kept the locale diffs to the changed lines only.
`pnpm i18n:lock` then `pnpm i18n:deep` confirmed nothing was left untranslated.

## Rules

- The provider is named only in `src/config/support.ts`.
  `src/config/support.test.ts` fails if the old one shows up anywhere live
  outside lessons/ and migrations/.
- To grant or revoke the extras, run `pnpm pro <email> [--revoke]`. Never
  `UPDATE users SET grants = 'pro'`, which assigns the set and drops `ig`.
