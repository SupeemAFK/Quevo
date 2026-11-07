import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { CustomerServiceSelection } from '@/components/customer-service-selection'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { availableServicesOptions, customerTicketOptions, joinQueue } from '@/lib/customer-queue'

export const Route = createFileRoute('/customer')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'CUSTOMER') throw redirect({ to: '/' })
  },
  component: CustomerServicesPage,
})

function CustomerServicesPage() {
  const servicesQuery = useQuery(availableServicesOptions)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const joinMutation = useMutation({
    mutationFn: (service: { branchId: string; serviceId: string }) => joinQueue({ data: service }),
    onSuccess: async (ticket) => {
      queryClient.setQueryData(customerTicketOptions(ticket.id).queryKey, ticket)
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

        {servicesQuery.isPending ? (
          <p aria-live="polite" className="py-5 text-sm text-muted-foreground" role="status">
            Loading available services…
          </p>
        ) : servicesQuery.isError ? (
          <div className="space-y-4">
            <p aria-live="polite" className="text-sm text-destructive" role="alert">
              {servicesQuery.error.message}
            </p>
            <Button onClick={() => servicesQuery.refetch()} variant="outline">
              Try again
            </Button>
          </div>
        ) : (
          <CustomerServiceSelection
            error={joinMutation.error?.message ?? ''}
            joining={joinMutation.isPending}
            onJoin={(service) => {
              joinMutation.reset()
              joinMutation.mutate({ branchId: service.branchId, serviceId: service.id })
            }}
            services={servicesQuery.data}
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
