import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { LandingHero } from '@/components/landing-hero'
import { LandingNavigation } from '@/components/landing-navigation'
import { LandingWorkflows } from '@/components/landing-workflows'
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
    <div className="min-h-svh bg-background text-foreground">
      <a
        className="sr-only fixed left-4 top-4 z-50 rounded-md border bg-card px-4 py-3 text-foreground focus:not-sr-only focus:ring-2 focus:ring-ring"
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
        <LandingWorkflows />
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-page py-6 sm:flex-row sm:items-center sm:justify-between">
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
