export interface SlideshowArgsParams {
  imagePaths: string[]
  audioPath: string | null
  outputPath: string
  perImageSeconds: number
  width: number
  height: number
}

/**
 * The ffmpeg command line for a slideshow. Each image becomes a looped input,
 * scaled and padded to one canvas, then concatenated. With audio, `-shortest`
 * ends the clip at whichever of the two runs out first.
 */
export function slideshowFfmpegArgs({
  imagePaths,
  audioPath,
  outputPath,
  perImageSeconds,
  width,
  height,
}: SlideshowArgsParams): string[] {
  const inputs = imagePaths.flatMap((image) => [
    '-loop',
    '1',
    '-t',
    String(perImageSeconds),
    '-i',
    image,
  ])
  const scaleFilters = imagePaths
    .map(
      (_, i) =>
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30[v${i}]`,
    )
    .join(';')
  const concatInputs = imagePaths.map((_, i) => `[v${i}]`).join('')
  const filter = `${scaleFilters};${concatInputs}concat=n=${imagePaths.length}:v=1:a=0[outv]`

  return [
    ...inputs,
    ...(audioPath ? ['-i', audioPath] : []),
    '-filter_complex',
    filter,
    '-map',
    '[outv]',
    ...(audioPath ? ['-map', `${imagePaths.length}:a`] : []),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'high',
    '-movflags',
    '+faststart',
    ...(audioPath ? ['-c:a', 'aac', '-b:a', '128k', '-shortest'] : []),
    '-y',
    outputPath,
  ]
}
