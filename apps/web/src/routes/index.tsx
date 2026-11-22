import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { LandingHero } from '@/components/landing-hero'
import { LandingNavigation } from '@/components/landing-navigation'
import { LandingReveal } from '@/components/landing-reveal'
import { LandingWorkflows } from '@/components/landing-workflows'
import { QueueDemo } from '@/components/queue-demo'
import { Button } from '@/components/ui/button'
import { getCurrentUser, signOut } from '@/lib/auth'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Quevo | A clearer queue for every visit' },
      {
        name: 'description',
        content: 'Follow a walk-in ticket from joining an active service through the final step.',
      },
    ],
  }),
  loader: async () => ({ user: await getCurrentUser() }),
  component: Home,
})

function Home() {
  const { user } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
      queryClient.removeQueries({ queryKey: ['customer'] })
      queryClient.removeQueries({ queryKey: ['operator'] })
      await router.invalidate()
    } catch {
      setSignOutError('Could not sign out. Please try again.')
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-svh overflow-hidden bg-background text-foreground">
        <a
          className="sr-only fixed left-4 top-4 z-50 rounded-md bg-background px-4 py-3 text-foreground shadow-md focus:not-sr-only focus:ring-2 focus:ring-ring"
          href="#main-content"
        >
          Skip to main content
        </a>
        <LandingNavigation
          onSignOut={() => void handleSignOut()}
          signOutError={signOutError}
          user={user}
        />

        <main id="main-content" tabIndex={-1}>
          <LandingHero user={user} />

          <QueueDemo />
          <LandingWorkflows />

          <section
            aria-labelledby="closing-heading"
            className="landing-closing relative isolate overflow-hidden bg-primary text-primary-foreground"
          >
            <div aria-hidden="true" className="landing-closing-orbit" />
            <LandingReveal className="relative mx-auto flex max-w-content flex-col items-start justify-between gap-6 px-page py-section sm:flex-row sm:items-center">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em]">
                  <span aria-hidden="true" className="landing-closing-dot" />
                  Ready for your next visit?
                </p>
                <h2 className="mt-3 text-section font-semibold tracking-tight" id="closing-heading">
                  Sign in and continue with your Quevo role.
                </h2>
              </div>
              <Button asChild className="min-h-12 shrink-0 px-5 text-base" variant="secondary">
                <Link to="/login">
                  Sign in to Quevo
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </LandingReveal>
          </section>
        </main>

        <footer className="border-t bg-background">
          <div className="mx-auto flex max-w-content flex-col gap-5 px-page py-7 sm:flex-row sm:items-center sm:justify-between">
            <Link
              aria-label="Quevo home"
              className="inline-flex min-h-11 items-center font-semibold tracking-tight focus-visible:outline"
              to="/"
            >
              Quevo
            </Link>
            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <li>
                  <a
                    className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline"
                    href="#top"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline"
                    href="#queue-demo"
                  >
                    Queue demo
                  </a>
                </li>
                <li>
                  <a
                    className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline"
                    href="#workflows"
                  >
                    How it works
                  </a>
                </li>
              </ul>
            </nav>
            <span className="text-sm text-muted-foreground">
              Queue management for walk-in service.
            </span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
