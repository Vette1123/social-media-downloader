import { describe, expect, it } from 'vitest'
import { shouldDropException } from './analyticsNoise'

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
