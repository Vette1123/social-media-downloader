/**
 * Split copy into plain text and filename-template tokens like `{date}`, so the
 * tokens render as code. Shown raw, "{date}, {platform}" in a feature bullet
 * read as a templating bug (UX review, 14 Nov), and in Arabic the braces
 * scattered through right-to-left text.
 */
export function splitTemplateTokens(text: string): Array<{ token: boolean; text: string }> {
  return text
    .split(/(\{[a-z]+\})/)
    .filter(Boolean)
    .map((part) => ({ token: /^\{[a-z]+\}$/.test(part), text: part }))
}
