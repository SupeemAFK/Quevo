import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { RefreshCw, TicketCheck } from 'lucide-react'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { CustomerServiceSelection } from '@/components/customer-service-selection'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { PageHeading } from '@/components/page-heading'
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
      <section className="mx-auto max-w-4xl p-0 sm:p-2">
        <header className="mb-7">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Customer
          </p>
          <PageHeading className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <TicketCheck aria-hidden="true" size={26} />
            Select a service
          </PageHeading>
          <p className="mt-2 text-muted-foreground">
            Join an active service to receive your ticket number.
          </p>
        </header>

        {queueQuery.isPending ? (
          <LoadingMessage>Loading your queue…</LoadingMessage>
        ) : queueQuery.isError ? (
          <div className="space-y-4">
            <FeedbackMessage kind="error">{queueQuery.error.message}</FeedbackMessage>
            <Button
              aria-disabled={queueQuery.isFetching}
              className="min-h-11 px-4 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              onClick={() => {
                if (!queueQuery.isFetching) void queueQuery.refetch()
              }}
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={
                  queueQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : undefined
                }
              />
              {queueQuery.isFetching ? 'Retrying…' : 'Try again'}
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
