import { describe, expect, it } from 'vitest'

import { slideshowFfmpegArgs } from './slideshowArgs'

const base = {
  imagePaths: ['a.jpg', 'b.jpg'],
  audioPath: null,
  outputPath: 'out.mp4',
  perImageSeconds: 3,
  width: 1080,
  height: 1920,
}

describe('slideshowFfmpegArgs', () => {
  it('puts each image option before its input', () => {
    expect(slideshowFfmpegArgs(base).slice(0, 12)).toEqual([
      '-loop', '1', '-t', '3', '-i', 'a.jpg',
      '-loop', '1', '-t', '3', '-i', 'b.jpg',
    ])
  })

  it('concatenates every image into the output stream', () => {
    const args = slideshowFfmpegArgs(base)
    const filter = args[args.indexOf('-filter_complex') + 1]
    expect(filter).toContain('[v0][v1]concat=n=2:v=1:a=0[outv]')
    expect(filter).toContain('scale=1080:1920')
  })

  it('leaves audio options out when there is no audio', () => {
    const args = slideshowFfmpegArgs(base)
    expect(args).not.toContain('-shortest')
    expect(args).not.toContain('-c:a')
  })

  it('maps audio from the input after the images', () => {
    const args = slideshowFfmpegArgs({ ...base, audioPath: 'song.mp3' })
    expect(args).toContain('2:a')
    expect(args).toContain('-shortest')
    expect(args.indexOf('song.mp3')).toBeLessThan(args.indexOf('-filter_complex'))
  })

  it('overwrites the output, which comes last', () => {
    expect(slideshowFfmpegArgs(base).slice(-2)).toEqual(['-y', 'out.mp4'])
  })
})
