/**
 * Turns whatever was pasted into `.env.fb-cookie` into one Cookie header: the
 * request header, or the DevTools Application table, which pastes one cookie per
 * line as tab-separated columns. Throws naming the missing cookies, and never
 * echoes a value: this is a live login, so an unrecognised name is only counted.
 */
const REQUIRED = ['c_user', 'xs']
const COOKIE_NAME = /^[\w.-]{1,40}$/

const tableRow = (line) => {
  const [name, value] = line.trim().split('\t')
  return `${name}=${value}`
}

export function parseFbCookie(pasted) {
  const lines = pasted
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
  const header = lines.some((line) => line.includes('\t'))
    ? lines.map(tableRow).join('; ')
    : lines.join(' ').replace(/^\s*cookie:\s*/i, '').trim()

  const pairs = header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  const names = pairs
    .map((pair) => pair.split('=')[0])
    .filter((name) => COOKIE_NAME.test(name))
  const missing = REQUIRED.filter((name) => {
    const pair = pairs.find((p) => p.startsWith(`${name}=`))
    return !pair || pair.length === name.length + 1
  })
  if (missing.length > 0) {
    throw new Error(
      `missing ${missing.join(' and ')}: found ${pairs.length} cookies (${names.join(', ') || 'no readable names'})`,
    )
  }
  return { header: pairs.join('; '), names }
}
