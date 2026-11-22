import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
  useRouterState,
} from '@tanstack/react-router'
import { MotionConfig, motion } from 'motion/react'
import { useEffect, useRef } from 'react'

import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Quevo' },
      { name: 'description', content: 'Quevo web application' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname ?? state.location.pathname,
  })
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    const focusFrame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('main h1[tabindex="-1"]')?.focus()
    })
    return () => window.cancelAnimationFrame(focusFrame)
  }, [pathname])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <MotionConfig reducedMotion="user">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 8 }}
            key={pathname}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </MotionConfig>
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="w-full max-w-lg rounded-lg border bg-card p-8 text-card-foreground sm:p-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="text-4xl font-semibold tracking-tight" tabIndex={-1}>
          Page not found
        </h1>
        <p className="mb-7 mt-3 text-muted-foreground">The page you requested does not exist.</p>
        <Link className="text-foreground underline-offset-4 hover:underline" to="/">
          Back to Quevo
        </Link>
      </section>
    </main>
  )
}
