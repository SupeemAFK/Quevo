import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { Identity } from '@/lib/auth'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
import { QueueBackdrop } from './queue-backdrop'
import { QuevoMark } from './quevo-mark'
import { Button } from './ui/button'

export function LandingFooter({ user }: { user: Identity | null }) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const appPath = user?.role === 'CUSTOMER' ? '/customer' : '/operator'

  return (
    <footer className="relative isolate overflow-hidden border-t border-border bg-background text-foreground">
      <QueueBackdrop reducedMotion={prefersReducedMotion} variant="footer" />
      <div className="relative z-10 mx-auto flex max-w-content flex-col gap-6 px-page py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
        <div>
          <Link
            aria-label="Quevo home"
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-lg font-semibold tracking-tight focus-visible:outline"
            to="/"
          >
            <QuevoMark className="size-6 shrink-0" />
            Quevo
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            Queue management for walk-in service.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <li>
                <a
                  className="inline-flex min-h-9 items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline"
                  href="#queue-demo"
                >
                  Live sample
                </a>
              </li>
              <li>
                <a
                  className="inline-flex min-h-9 items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline"
                  href="#workflows"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  className="inline-flex min-h-9 items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline"
                  href="#top"
                >
                  Back to top
                </a>
              </li>
            </ul>
          </nav>
          <Button asChild className="group min-h-10 px-4" size="sm" variant="outline">
            <Link to={user ? appPath : '/login'}>
              {user ? 'Open queue' : 'Sign in'}
              <ArrowRight
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
          </Button>
        </div>
      </div>
    </footer>
  )
}
