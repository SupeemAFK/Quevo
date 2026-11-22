import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { CustomerTicketDetails } from '@/components/customer-ticket-details'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { PageHeading } from '@/components/page-heading'
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
  const [feedback, setFeedback] = useState<{ message: string; kind: 'success' | 'error' } | null>(
    null,
  )
  const ticketQuery = useQuery({
    ...customerTicketOptions(user.id, ticketId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  async function refreshStatus() {
    if (ticketQuery.isFetching) return
    setFeedback(null)
    const result = await ticketQuery.refetch()
    setFeedback(
      result.isError
        ? { message: 'Could not refresh ticket status. Please try again.', kind: 'error' }
        : { message: 'Ticket status updated.', kind: 'success' },
    )
  }

  return (
    <AuthenticatedShell currentSection="customer" user={user}>
      <section className="mx-auto max-w-4xl p-0 sm:p-2">
        <header className="mb-7">
          <PageHeading className="text-3xl font-semibold tracking-tight">Your ticket</PageHeading>
        </header>

        {ticketQuery.isPending ? (
          <LoadingMessage>Loading your ticket…</LoadingMessage>
        ) : ticketQuery.data ? (
          <CustomerTicketDetails
            feedback={feedback}
            onRefresh={() => void refreshStatus()}
            refreshing={ticketQuery.isFetching}
            ticket={ticketQuery.data}
          />
        ) : ticketQuery.isError ? (
          <div className="my-6 space-y-4">
            <FeedbackMessage kind="error">{ticketQuery.error.message}</FeedbackMessage>
            <Button
              aria-disabled={ticketQuery.isFetching}
              className="min-h-11 px-4 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              onClick={() => void refreshStatus()}
              variant="outline"
            >
              {ticketQuery.isFetching ? 'Refreshing…' : 'Try again'}
            </Button>
          </div>
        ) : null}
      </section>
    </AuthenticatedShell>
  )
}
