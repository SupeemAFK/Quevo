import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { customerTicketOptions } from '@/lib/customer-queue'

export const Route = createFileRoute('/tickets/$ticketId')({
  component: CustomerTicketPage,
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'CUSTOMER') throw redirect({ to: '/' })
    return { user }
  },
})

function CustomerTicketPage() {
  const { user } = Route.useRouteContext()
  const { ticketId } = Route.useParams()
  const ticketQuery = useQuery(customerTicketOptions(user.id, ticketId))

  return (
    <AuthenticatedShell currentSection="customer" user={user}>
      <section className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <header className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
            Customer ticket
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your ticket</h1>
        </header>

        {ticketQuery.isPending ? (
          <p aria-live="polite" className="py-6 text-sm text-muted-foreground" role="status">
            Loading your ticket…
          </p>
        ) : ticketQuery.isError ? (
          <div className="my-6 space-y-4">
            <p aria-live="polite" className="text-sm text-destructive" role="alert">
              {ticketQuery.error.message}
            </p>
            <Button onClick={() => ticketQuery.refetch()} variant="outline">
              Try again
            </Button>
          </div>
        ) : (
          <div className="my-6 rounded-lg border bg-muted/40 p-6">
            <p className="text-sm text-muted-foreground">Ticket number</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight" data-testid="ticket-number">
              {ticketQuery.data.ticketNumber}
            </p>
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium" role="status">
                {ticketQuery.data.status}
              </dd>
              <dt className="text-muted-foreground">Service</dt>
              <dd>{ticketQuery.data.serviceName}</dd>
              <dt className="text-muted-foreground">Branch</dt>
              <dd>{ticketQuery.data.branchName}</dd>
              <dt className="text-muted-foreground">Business date</dt>
              <dd>{ticketQuery.data.businessDate}</dd>
            </dl>
          </div>
        )}
      </section>
    </AuthenticatedShell>
  )
}
