import { splitTemplateTokens } from '@/lib/templateTokens'

/** Copy whose `{token}`s render as small left-to-right code chips. */
export function TemplateText({ text }: { text: string }) {
  return splitTemplateTokens(text).map((part, i) =>
    part.token ? (
      <code
        key={i}
        dir='ltr'
        className='rounded bg-white/[0.08] px-1 py-px font-mono text-[0.85em] text-cyan-100/90'
      >
        {part.text}
      </code>
    ) : (
      part.text
    ),
  )
}
