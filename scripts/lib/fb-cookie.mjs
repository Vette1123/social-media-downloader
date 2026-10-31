/**
 * Turns whatever was pasted into `.env.fb-cookie` into one Cookie header. Throws
 * naming the missing cookies, and never echoes a value: this is a live login.
 */
const REQUIRED = ['c_user', 'xs']

export function parseFbCookie(pasted) {
  const header = pasted
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .join(' ')
    .replace(/^\s*cookie:\s*/i, '')
    .trim()

  const pairs = header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  const names = pairs.map((pair) => pair.split('=')[0])
  const missing = REQUIRED.filter((name) => {
    const pair = pairs.find((p) => p.startsWith(`${name}=`))
    return !pair || pair.length === name.length + 1
  })
  if (missing.length > 0) {
    throw new Error(
      `missing ${missing.join(' and ')}: found ${pairs.length} cookies (${names.join(', ') || 'none'})`,
    )
  }
  return { header: pairs.join('; '), names }
}
