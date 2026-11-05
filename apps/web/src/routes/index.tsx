import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ApiHealthStatus } from '@/components/api-health-status'
import { apiHealthOptions } from '@/lib/api'

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(apiHealthOptions),
  component: Home,
})

function Home() {
  const { data: health } = useSuspenseQuery(apiHealthOptions)

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
        <Button asChild variant="outline">
          <a href="http://localhost:8080/swagger/">Open API docs</a>
        </Button>
      </section>
    </main>
  )
}
