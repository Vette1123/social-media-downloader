# Telegram bot: live, localized, findable

## What
Created @SocialDownloaderSpaceBot, wired it with `pnpm telegram:setup`, and made it findable. Telegram search matches the bot's name and About text, so both now carry the queries people type, in all five site languages (`src/lib/telegramCopy.ts`, the one source for both the replies and the published profile). `--profile` republishes name, About, description, commands and the avatar (`/icons/maskable`) without rotating secrets; `--check` reports webhook health. Replies follow the user's `language_code`, `/help` lists what works and what doesn't, and every greeting links the site. The site links back: footer, Organization `sameAs`, `llms.txt`.

## Mistakes
- First `/start` got no answer: the WAF's "challenge scripted clients" rule 403'd Telegram, which posts with no user agent. Only `getWebhookInfo.last_error_message` said so. `/api/telegram` is now exempt beside `/api/billing/`.
- `wrangler tail` failed with "fetch failed": this box needs `--dns-result-order=ipv4first` for wrangler too, not just undici scripts.
- `node -e "import('./scripts/cf-setup.mjs')"` ran its default `check` command; a script with top-level side effects can't be imported for one constant.
- The clipboard was overwritten once between copying the token and running setup; run setup straight after the click.
- Multi-line string replacements through a node heredoc failed on CRLF files; use the Edit tool.

## What worked
- Node 26 imports the `.ts` copy module straight from the `.mjs` script (type-only imports erase), so there's no second copy of the text.
- `setMyProfilePhoto` exists in the Bot API now; the avatar needs no BotFather session.
- The full-bleed maskable icon suits Telegram's circle crop; the rounded-square one leaves transparent corners.

## Rules
- A new webhook path: add it to the WAF exemptions in `cf-setup.mjs` before registering it.
- Bot copy changes go in `telegramCopy.ts`, then `pnpm telegram:setup --profile`; a test pins Telegram's length limits.
