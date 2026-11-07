import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { CustomerServiceSelection } from '@/components/customer-service-selection'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { customerQueueOptions, customerTicketOptions, joinQueue } from '@/lib/customer-queue'

export const Route = createFileRoute('/customer')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'CUSTOMER') throw redirect({ to: '/' })
    return { user }
  },
  component: CustomerServicesPage,
})

function CustomerServicesPage() {
  const { user } = Route.useRouteContext()
  const queueQuery = useQuery(customerQueueOptions(user.id))
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const joinMutation = useMutation({
    mutationFn: (service: { branchId: string; serviceId: string }) => joinQueue({ data: service }),
    onSuccess: async (ticket) => {
      queryClient.setQueryData(customerTicketOptions(user.id, ticket.id).queryKey, ticket)
      queryClient.setQueryData(customerQueueOptions(user.id).queryKey, (current) =>
        current
          ? {
              ...current,
              activeTickets: [
                ticket,
                ...current.activeTickets.filter((activeTicket) => activeTicket.id !== ticket.id),
              ],
            }
          : current,
      )
      await navigate({
        to: '/tickets/$ticketId',
        params: { ticketId: ticket.id },
      })
    },
  })

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="w-full max-w-xl rounded-xl border bg-card p-8 text-card-foreground shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Customer queue
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Join a queue</h1>
        <p className="mb-7 mt-2 text-sm text-muted-foreground">
          Choose an active service to receive your ticket number.
        </p>

        {queueQuery.isPending ? (
          <p aria-live="polite" className="py-5 text-sm text-muted-foreground" role="status">
            Loading your queue…
          </p>
        ) : queueQuery.isError ? (
          <div className="space-y-4">
            <p aria-live="polite" className="text-sm text-destructive" role="alert">
              {queueQuery.error.message}
            </p>
            <Button onClick={() => queueQuery.refetch()} variant="outline">
              Try again
            </Button>
          </div>
        ) : (
          <CustomerServiceSelection
            error={joinMutation.error?.message ?? ''}
            activeTickets={queueQuery.data.activeTickets}
            joining={joinMutation.isPending}
            onJoin={(service) => {
              joinMutation.reset()
              joinMutation.mutate({ branchId: service.branchId, serviceId: service.id })
            }}
            services={queueQuery.data.services}
          />
        )}

        <Link
          className="mt-7 inline-block text-sm text-primary underline-offset-4 hover:underline"
          to="/"
        >
          Back to Quevo
        </Link>
      </section>
    </main>
  )
}
