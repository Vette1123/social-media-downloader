import { describe, expect, it } from 'vitest'
import { isForeignEarlyError, shouldDropException } from './analyticsNoise'

const exception = (value: string, filenames: string[] = []) => ({
  properties: {
    $exception_list: [
      {
        type: 'Error',
        value,
        stacktrace: { frames: filenames.map((filename) => ({ filename })) },
      },
    ],
  },
})

describe('shouldDropException', () => {
  it('drops extension collisions and dropped connections', () => {
    expect(shouldDropException(exception('ResizeObserver loop completed'))).toBe(true)
    expect(shouldDropException(exception('Failed to fetch'))).toBe(true)
  })

  it('drops the early-crash "Script error." and the iOS no-stack DOMExceptions', () => {
    expect(shouldDropException(exception('[early_crash] Script error.'))).toBe(true)
    expect(shouldDropException(exception('NotSupportedError: The operation is not supported.'))).toBe(true)
    expect(shouldDropException(exception("Can't find variable: EmptyRanges"))).toBe(true)
    expect(shouldDropException(exception('AbortError: The operation was aborted.'))).toBe(true)
    expect(
      shouldDropException(
        exception(
          'NotSupportedError: The media resource indicated by the src attribute or assigned media provider object was not suitable.',
        ),
      ),
    ).toBe(true)
  })

  it('drops the WebKit NotFoundError the early reporter sends without its type', () => {
    expect(shouldDropException(exception('[early_crash] The object can not be found here.'))).toBe(
      true,
    )
  })

  it('drops a stack with no frame of ours', () => {
    expect(
      shouldDropException(exception('boom', ['https://x.space/:224:408'])),
    ).toBe(true)
  })

  it('keeps a real error in our bundle', () => {
    expect(
      shouldDropException(exception('boom', ['https://x.space/_next/static/a.js'])),
    ).toBe(false)
  })

  it('keeps an error with no stack at all', () => {
    expect(shouldDropException(exception('boom'))).toBe(false)
  })
})

describe('isForeignEarlyError', () => {
  const thrown = (...lines: string[]) => Object.assign(new Error('x'), { stack: lines.join('\n') })
  const ours = 'https://site.app/_next/static/chunks/a.js'

  it('drops a wallet script that threw before the SDK booted', () => {
    const err = thrown(
      "TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
      '    at chrome-extension://abc/inpage.js:1:200',
    )
    expect(isForeignEarlyError('chrome-extension://abc/inpage.js', err)).toBe(true)
    expect(
      isForeignEarlyError('', thrown("TypeError: reading 'M_ID'", '    at https://cdn.x.com/lib.js:3:9')),
    ).toBe(true)
  })

  it('drops a stack that names a script by file alone, with no scheme', () => {
    expect(isForeignEarlyError('', thrown('Error: x', '    at inpage.js:3:9'))).toBe(true)
  })

  // Chrome iOS, 2026-11-09: "[early_rejection] Error: Na", a closure-minified
  // name that is nowhere in our bundle. The reason failed `instanceof Error`
  // (String() gave "Error: Na"), so it was built in another JS realm.
  it('drops an Error from another realm, which never passes instanceof', () => {
    const foreignRealm = { name: 'Error', message: 'Na', stack: '' }
    expect(isForeignEarlyError('', foreignRealm)).toBe(true)
    const named = { name: 'Error', message: 'x', stack: 'Na@https://cdn.x.com/a.js:1:2' }
    expect(isForeignEarlyError('', named)).toBe(true)
  })

  it('keeps an Error from another realm whose stack is ours', () => {
    const ownStack = { name: 'Error', message: 'boom', stack: `m@${ours}:1:2` }
    expect(isForeignEarlyError('', ownStack)).toBe(false)
  })

  it('keeps a crash in our bundle', () => {
    expect(isForeignEarlyError(ours, thrown('Error: boom', `    at ${ours}:1:2`))).toBe(false)
    expect(isForeignEarlyError('', thrown('Error: boom', `    at ${ours}:1:2`))).toBe(false)
  })

  it('keeps what it cannot place: no filename, no stack, a bare rejection reason', () => {
    expect(isForeignEarlyError('', 'just a string')).toBe(false)
    expect(isForeignEarlyError(undefined, thrown('Error: boom'))).toBe(false)
  })
})

describe('isForeignEarlyError, by message alone', () => {
  // 2026-11-03..09, 49 events: a cross-origin script's error reaches window.onerror
  // as the bare string "Script error." with no filename and no Error object.
  it.each([
    'Script error.',
    "Minified React error #418; visit https://react.dev/errors/418 for the full message",
    "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
    'The object can not be found here.',
    "undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
    "Cannot read properties of undefined (reading 'M_ID')",
  ])('drops %s', (message) => {
    expect(isForeignEarlyError('', message)).toBe(true)
    expect(isForeignEarlyError('', new Error(message))).toBe(true)
  })

  it('keeps an ordinary message', () => {
    expect(isForeignEarlyError('', 'boom')).toBe(false)
  })
})
