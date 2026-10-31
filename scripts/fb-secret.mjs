// Uploads `.env.fb-cookie` as the FB_COOKIE Worker secret, then deletes the file.
// `.env*` is gitignored. Run it again whenever Facebook ends the session.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { parseFbCookie } from './lib/fb-cookie.mjs'

const FILE = '.env.fb-cookie'
const TEMPLATE = `# Paste the whole Facebook Cookie value below this line, then run: pnpm fb:secret
`

if (!existsSync(FILE)) {
  writeFileSync(FILE, TEMPLATE)
  console.log(`created ${FILE}: paste the cookie into it and run this again`)
  process.exit(1)
}

let parsed
try {
  parsed = parseFbCookie(readFileSync(FILE, 'utf8'))
} catch (e) {
  console.error(`${FILE}: ${e.message}. Nothing was uploaded.`)
  process.exit(1)
}

console.log(`uploading ${parsed.names.length} cookies: ${parsed.names.join(', ')}`)
const upload = spawnSync('pnpm exec wrangler secret put FB_COOKIE', {
  input: parsed.header,
  shell: true,
  stdio: ['pipe', 'inherit', 'inherit'],
})
if (upload.status !== 0) {
  console.error(`wrangler exited ${upload.status}. ${FILE} was kept, nothing changed.`)
  process.exit(1)
}

rmSync(FILE)
console.log(`FB_COOKIE is set and ${FILE} is deleted`)
