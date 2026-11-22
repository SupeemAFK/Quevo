import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { LoginForm } from '@/components/login-form'
import { PageHeading } from '@/components/page-heading'
import { signIn } from '@/lib/auth'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  function handleLoginSuccess() {
    queryClient.removeQueries({ queryKey: ['customer'] })
    queryClient.removeQueries({ queryKey: ['operator'] })
    void router.navigate({ to: '/' })
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="w-full max-w-md rounded-lg border bg-card p-7 text-card-foreground sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quevo account
        </p>
        <PageHeading className="text-3xl font-semibold tracking-tight">
          Sign in to Quevo
        </PageHeading>
        <p className="mb-7 mt-2 text-sm text-muted-foreground">
          Use your seeded customer or operator account.
        </p>
        <LoginForm
          onSuccess={handleLoginSuccess}
          signIn={async (input) => signIn({ data: input })}
        />
        <Link
          className="mt-6 inline-flex min-h-11 items-center text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline"
          to="/"
        >
          Back to Quevo
        </Link>
      </section>
    </main>
  )
}
