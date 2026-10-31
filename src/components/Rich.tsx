import { Fragment, type ReactNode } from 'react'

/** A translated sentence with elements inside it, wherever its grammar put them. */
export function Rich({
  text,
  parts,
}: {
  text: string
  parts: Record<string, ReactNode>
}) {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const name = piece.match(/^\{(\w+)\}$/)?.[1]
    return (
      <Fragment key={i}>{name && name in parts ? parts[name] : piece}</Fragment>
    )
  })
}
