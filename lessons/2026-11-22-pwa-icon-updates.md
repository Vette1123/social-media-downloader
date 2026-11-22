# Installed PWAs and the icon version, 2026-11-22

## What

- The owner's installed PWA still showed the pre-11-16 icon. The site was already right: the
  manifest served `?v=4` icons since the new mark shipped, while the installed WebAPK, last
  rebuilt 2026-10-24, held `?v=3`.
- On launch Chrome logged `WebAPK upgrade needed: true`. It rebuilds the WebAPK only after
  every app window closes, with the phone charging and on Wi-Fi. An app nobody reopens never
  updates.
- New guard: `src/lib/iconVersion.json` pins the icon version and a fingerprint of the files
  that draw the icon. `appIcon.test.ts` fails when the art changes without a bump.
  `pnpm icons:bump` moves the version, every manifest `?v=` and the fingerprint together.
- App content already updates on every launch: there is no service worker, and HTML and the
  manifest revalidate (`max-age=0`).

## Mistakes

- `ICON_VERSION` was a hand-bumped constant, and its test only checked that the manifest
  agreed with it. Nothing tied it to the art, so new art with a forgotten bump would have
  passed CI and stayed invisible to every installed user.
- The first `icons:bump` found nothing: a git-bash heredoc halved the regex backslashes.
  `String.raw` fixed it, and the red/green run caught it.

## What worked

- Reading the installed WebAPK's own manifest (`adb pull` of the base APK, then the URLs
  inside) showed `?v=3` against the live `?v=4` in one step.
- Red/green: an art edit fails the fingerprint test; `icons:bump` moves 14 manifest srcs and
  turns it green.

## Rules

- Change the icon art, run `pnpm icons:bump`. The test will say so.
- Chrome, Edge and Samsung Internet on Android refresh an installed icon when its URL
  changes, after the app is closed while charging on Wi-Fi. Brave, Firefox and iOS keep a
  static shortcut, so the only fix there is re-adding the app.
