import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { RefreshCw, TicketCheck } from 'lucide-react'
import { useState } from 'react'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { CustomerServiceSelection } from '@/components/customer-service-selection'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { PageHeading } from '@/components/page-heading'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { customerQueueOptions, customerTicketOptions, joinQueue } from '@/lib/customer-queue'
import { uploadTicketDocument } from '@/lib/ticket-documents'

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
  const queueQuery = useQuery({
    ...customerQueueOptions(user.id),
    refetchOnMount: 'always',
  })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const joinMutation = useMutation({
    mutationFn: async (service: {
      branchId: string
      serviceId: string
      queueId: string
      requestAnswers: Record<string, string>
      documents: File[]
    }) => {
      const { documents, ...joinInput } = service
      const ticket = await joinQueue({ data: joinInput })
      const uploadResults = await Promise.all(
        documents.map(async (file) => {
          try {
            await uploadTicketDocument(ticket.id, file)
            return ''
          } catch (uploadError) {
            return uploadError instanceof Error
              ? uploadError.message
              : 'A document could not be uploaded.'
          }
        }),
      )
      return { ticket, uploadError: uploadResults.find(Boolean) ?? '' }
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: customerQueueOptions(user.id).queryKey })
    },
    onSuccess: async ({ ticket, uploadError }) => {
      queryClient.setQueryData(customerTicketOptions(user.id, ticket.id).queryKey, ticket)
      queryClient.setQueryData(customerQueueOptions(user.id).queryKey, (current) =>
        current
          ? {
              ...current,
              activeTickets: [ticket],
            }
          : current,
      )
      if (uploadError) {
        setNotice(
          `Ticket ${ticket.ticketNumber} was created, but a document could not be uploaded (${uploadError}). Open your ticket below to try again.`,
        )
        return
      }
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
            notice={notice}
            onJoin={(service, queueID, requestAnswers, documents) => {
              joinMutation.reset()
              setNotice('')
              joinMutation.mutate({
                branchId: service.branchId,
                serviceId: service.id,
                queueId: queueID,
                requestAnswers,
                documents,
              })
            }}
            services={queueQuery.data.services}
          />
        )}
      </section>
    </AuthenticatedShell>
  )
}
