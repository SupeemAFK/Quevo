import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import { LandingNavigation } from '@/components/landing-navigation'
import { LandingWorkflows } from '@/components/landing-workflows'
import { QueueDemo } from '@/components/queue-demo'
import { Button } from '@/components/ui/button'
import { getCurrentUser, signOut } from '@/lib/auth'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Quevo | Walk-in queues, easier to follow' },
      {
        name: 'description',
        content:
          'Quevo helps customers join an active branch service and helps operators guide each ticket through service.',
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

      <main id="main-content">
        <section
          aria-labelledby="hero-heading"
          className="mx-auto grid max-w-content gap-12 px-page py-section md:grid-cols-[1.05fr_0.95fr] md:items-center"
          id="top"
        >
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm">
              <span aria-hidden="true" className="size-2 rounded-full bg-status-success" />A clearer
              walk-in queue
            </p>
            <h1
              className="mt-6 text-display font-semibold leading-[1.02] tracking-[-0.045em]"
              id="hero-heading"
            >
              Walk-in queues,
              <span className="block text-primary">easier to follow.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Quevo helps customers join an available branch service and gives operators a clear
              view of who is waiting and who is being served.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="min-h-12 px-5 text-base">
                <Link to={user ? (user.role === 'CUSTOMER' ? '/customer' : '/operator') : '/login'}>
                  {user ? 'Open your queue' : 'Sign in to Quevo'}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild className="min-h-12 px-5 text-base" variant="outline">
                <a href="#queue-demo">Try the queue demo</a>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Existing Quevo users can sign in with their customer or operator account.
            </p>
          </div>

          <aside
            aria-label="A sample view of the queue journey"
            className="relative mx-auto w-full max-w-lg rounded-3xl border bg-card p-5 shadow-xl shadow-primary/5 sm:p-8"
          >
            <div
              aria-hidden="true"
              className="absolute -right-8 -top-8 size-32 rounded-full bg-secondary blur-2xl"
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-4 border-b pb-5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Queue journey</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">From join to service</p>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <Check aria-hidden="true" size={21} />
                </span>
              </div>
              <ol className="mt-6 space-y-4">
                <li className="flex items-center gap-4 rounded-xl bg-muted p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-sm font-semibold text-foreground">
                    1
                  </span>
                  <span>
                    <span className="block font-medium">Join a service</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      Choose an active branch service.
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    2
                  </span>
                  <span>
                    <span className="block font-medium">Follow your ticket</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      See its current queue status.
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-4 rounded-xl bg-muted p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-sm font-semibold text-foreground">
                    3
                  </span>
                  <span>
                    <span className="block font-medium">Complete the visit</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      Operators record the final action.
                    </span>
                  </span>
                </li>
              </ol>
            </div>
          </aside>
        </section>

        <QueueDemo />
        <LandingWorkflows />

        <section aria-labelledby="closing-heading" className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-6 px-page py-section sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em]">
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
          </div>
        </section>
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-content flex-col gap-5 px-page py-7 sm:flex-row sm:items-center sm:justify-between">
          <Link aria-label="Quevo home" className="font-semibold tracking-tight" to="/">
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
  )
}
