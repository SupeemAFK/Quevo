import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<'h1'>, 'ref'>

export function PageHeading({ tabIndex = -1, ...props }: Props) {
  return <h1 {...props} tabIndex={tabIndex} />
}
