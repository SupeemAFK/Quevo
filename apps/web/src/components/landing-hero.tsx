import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowRight } from 'lucide-react'
import type { Identity } from '@/lib/auth'
import { PageHeading } from './page-heading'
import { QueueDemo } from './queue-demo'
import { Button } from './ui/button'

type LandingHeroProps = {
  user: Identity | null
}

export function LandingHero({ user }: LandingHeroProps) {
  const appPath = user?.role === 'CUSTOMER' ? '/customer' : '/operator'

  return (
    <section
      aria-labelledby="hero-heading"
      className="border-b bg-background"
      id="top"
      tabIndex={-1}
    >
      <div className="mx-auto grid max-w-content items-center gap-10 px-page py-14 sm:py-18 lg:min-h-[650px] lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:py-20">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            <span aria-hidden="true" className="size-2 rounded-full bg-brand-green" />
            Queue management for in-person service
          </p>
          <PageHeading
            className="mt-6 max-w-[11ch] text-display font-semibold leading-[0.98] tracking-[-0.065em]"
            id="hero-heading"
          >
            Your place in line. Made clear.
          </PageHeading>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
            Join a walk-in queue from your phone, follow your ticket, and let the service team keep
            things moving.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild className="min-h-12 px-5 text-base">
              <Link to={user ? appPath : '/login'}>
                {user ? 'Open your queue' : 'Sign in to Quevo'}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild className="min-h-12 border-border px-5 text-base" variant="outline">
              <a href="#queue-demo">
                Explore the sample
                <ArrowDown aria-hidden="true" />
              </a>
            </Button>
          </div>
          <div className="mt-10 flex max-w-md items-center gap-4 border-t pt-4 text-sm">
            <span className="font-medium">One queue</span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
            <span className="text-muted-foreground">Two clear views</span>
          </div>
        </div>

        <div className="relative min-w-0 lg:pl-2">
          <div
            aria-hidden="true"
            className="absolute -inset-x-3 -bottom-3 top-3 rounded-xl border bg-muted"
          />
          <div className="relative">
            <QueueDemo />
          </div>
        </div>
      </div>
    </section>
  )
}
