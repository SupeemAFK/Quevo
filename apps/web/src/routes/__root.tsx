import { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

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
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="w-full max-w-lg rounded-xl border bg-card p-10 text-card-foreground shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">404</p>
        <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
        <p className="mb-7 mt-3 text-muted-foreground">The page you requested does not exist.</p>
        <Link className="text-primary underline-offset-4 hover:underline" to="/">
          Back to Quevo
        </Link>
      </section>
    </main>
  )
}
