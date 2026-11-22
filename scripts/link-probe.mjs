// Resolve real links through the real Downloader, from this machine.
//
//   pnpm link:probe [--audio] <url> [url…]
//
// Prints, per link, what the chain returned (title, media count, file host) or
// the exact error a visitor would see. It runs from a home connection, not a
// Cloudflare colo, so a link that resolves here and fails in production points
// at an origin block, not at the parser. Exits 1 when any link fails, so a
// before/after run of the same list is a red/green check.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createViteServer } from "vitest/node";

const root = fileURLToPath(new URL("..", import.meta.url));
// --audio runs the MP3 flow (Downloader mode "audio") instead of the video one.
const args = process.argv.slice(2);
const mode = args.includes("--audio") ? "audio" : "auto";
const urls = args.filter((a) => a !== "--audio");
if (urls.length === 0) {
  console.error("usage: pnpm link:probe [--audio] <url> [url…]");
  process.exit(2);
}

const vite = await createViteServer({
  root,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: { "@": join(root, "src") } },
});

let failed = 0;
try {
  const { Downloader } = await vite.ssrLoadModule("/src/lib/downloader.ts");
  const { detectPlatform, extractLink } = await vite.ssrLoadModule(
    "/src/lib/validator.ts",
  );
  for (const raw of urls) {
    const url = extractLink(raw) ?? raw;
    const started = Date.now();
    try {
      const data = await new Downloader({ mode }).downloadVideo(url);
      const items = data.images?.length ?? 0;
      const media = data.downloadUrl || data.musicUrl;
      // A proxied result is a same-origin path (/api/video?url=…), not a URL.
      let file = "gallery";
      if (media) file = media.startsWith("/") ? media.split("?")[0] : new URL(media).host;
      console.log(
        `ok   ${detectPlatform(url)}  ${url}\n     ${items ? `${items} items` : file}  "${String(data.title).slice(0, 60)}"  ${Date.now() - started}ms`,
      );
    } catch (e) {
      failed++;
      console.log(
        `FAIL ${detectPlatform(url)}  ${url}\n     ${e instanceof Error ? e.message : e}  ${Date.now() - started}ms`,
      );
    }
  }
} finally {
  await vite.close();
}
console.log(`${urls.length - failed}/${urls.length} resolved`);
process.exit(failed ? 1 : 0);
