#!/usr/bin/env node
/**
 * Finds every sentence that goes through `d('…')`, plus the title and hint
 * strings of the two modules that build messages outside React, and checks each
 * language has them.
 *
 *   pnpm i18n:deep          fails with the count and sentences that are missing
 *   pnpm i18n:deep --write  writes the missing sentences to the path after --write
 *
 * Reads source with the TypeScript parser, so a template with a variable inside
 * `d()` is reported as an error instead of being silently unfindable.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const MESSAGE_MODULES = ['src/lib/errorMessages.ts', 'src/lib/linkAdvice.ts']
const LANGUAGES = ['es', 'pt', 'id', 'ar']

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })
}

const isText = (node) =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)

export function collectDeepStrings() {
  const strings = new Set()
  const errors = []
  for (const file of sourceFiles('src')) {
    const source = readFileSync(file, 'utf8')
    const messages = MESSAGE_MODULES.includes(file.replaceAll('\\', '/'))
    if (!messages && !source.includes('@/lib/i18nDeep')) continue
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const visit = (node) => {
      if (ts.isCallExpression(node) && ['d', 'dn'].includes(node.expression.getText())) {
        const [first] = node.arguments
        if (first && isText(first)) strings.add(first.text)
        else if (ts.isConditionalExpression(first)) {
          strings.add(first.whenTrue.text)
          strings.add(first.whenFalse.text)
        } else if (first) errors.push(`${file}: d() needs a plain string: ${first.getText().slice(0, 60)}`)
      }
      if (
        messages &&
        ts.isPropertyAssignment(node) &&
        ['title', 'hint'].includes(node.name.getText()) &&
        isText(node.initializer)
      ) {
        strings.add(node.initializer.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  return { strings: [...strings].sort(), errors }
}

export function missingDeepStrings() {
  const { strings, errors } = collectDeepStrings()
  const missing = {}
  for (const language of LANGUAGES) {
    const dictionary = JSON.parse(
      readFileSync(`src/content/locales/deep/${language}.json`, 'utf8'),
    )
    const absent = strings.filter((s) => !dictionary[s])
    if (absent.length > 0) missing[language] = absent
  }
  return { strings, errors, missing }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { strings, errors, missing } = missingDeepStrings()
  const target = process.argv[process.argv.indexOf('--write') + 1]
  if (process.argv.includes('--write')) {
    const all = [...new Set(Object.values(missing).flat())].sort()
    writeFileSync(target, JSON.stringify(Object.fromEntries(all.map((s) => [s, s])), null, 2))
    console.log(`Wrote ${all.length} of ${strings.length} sentences to ${target}`)
  }
  for (const error of errors) console.error(error)
  const counts = Object.entries(missing).map(([l, s]) => `${l}: ${s.length}`)
  if (errors.length > 0 || counts.length > 0) {
    console.error(`${strings.length} sentences; missing ${counts.join(', ') || 'none'}`)
    process.exit(1)
  }
  console.log(`${strings.length} sentences present in ${LANGUAGES.length} languages.`)
}
