import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { AuthenticatedShell } from '@/components/authenticated-shell'
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
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: customerQueueOptions(user.id).queryKey })
    },
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
    <AuthenticatedShell currentSection="customer" user={user}>
      <section className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <header className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
            Customer queue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Join a queue</h1>
          <p className="mt-2 text-muted-foreground">
            Choose an active service to receive your ticket number.
          </p>
        </header>

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
      </section>
    </AuthenticatedShell>
  )
}
