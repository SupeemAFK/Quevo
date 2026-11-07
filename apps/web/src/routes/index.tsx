import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiHealthStatus } from '@/components/api-health-status'
import { Button } from '@/components/ui/button'
import { apiHealthOptions } from '@/lib/api'
import { getCurrentUser, signOut } from '@/lib/auth'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(apiHealthOptions)
    return { user: await getCurrentUser() }
  },
  component: Home,
})

function Home() {
  const { data: health } = useSuspenseQuery(apiHealthOptions)
  const { user } = Route.useLoaderData()
  const router = useRouter()
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
      await router.invalidate()
    } catch {
      setSignOutError('Could not sign out. Please try again.')
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="w-full max-w-lg rounded-xl border bg-card p-10 text-card-foreground shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quevo starter
        </p>
        <h1 className="text-5xl font-semibold tracking-tight">Quevo</h1>
        <p className="mb-7 mt-3 leading-7 text-muted-foreground">
          Your web app and Go API are connected.
        </p>
        <ApiHealthStatus health={health} />
        {user ? (
          <div className="my-6 rounded-lg border bg-muted/40 p-4">
            <p className="font-medium">Signed in as {user.displayName}</p>
            <p className="mb-3 text-sm text-muted-foreground">Role: {user.role}</p>
            {user.role === 'CUSTOMER' ? (
              <Button asChild className="mb-3 w-full">
                <Link to="/customer">Choose a service</Link>
              </Button>
            ) : null}
            <Button onClick={handleSignOut} variant="outline">
              Sign out
            </Button>
            {signOutError ? (
              <p aria-live="polite" className="mt-3 text-sm text-destructive" role="alert">
                {signOutError}
              </p>
            ) : null}
          </div>
        ) : (
          <Button asChild className="my-6">
            <Link to="/login">Sign in</Link>
          </Button>
        )}
        <div>
          <Button asChild variant="outline">
            <a href="http://localhost:8080/swagger/">Open API docs</a>
          </Button>
        </div>
      </section>
    </main>
  )
}
