import type { SVGProps } from 'react'

/** A small ordered-ticket mark for Quevo's brand and app icon. */
export function QuevoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M5 4v16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <circle cx="5" cy="5" r="2.3" fill="var(--brand-green)" />
      <circle
        cx="5"
        cy="12"
        r="1.8"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="5"
        cy="19"
        r="1.8"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10 5h9M10 12h7M10 19h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
