import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { OperatorQueue } from '@/components/operator-queue'
import { PageHeading } from '@/components/page-heading'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import {
  callNext,
  operatorQueueOptions,
  operatorQueuesOptions,
  updateOperatorTicket,
} from '@/lib/operator-queue'

type Action = 'call-next' | 'start' | 'complete' | 'skip'

export const Route = createFileRoute('/operator')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'OPERATOR') throw redirect({ to: '/' })
    return { user }
  },
  component: OperatorPage,
})

function OperatorPage() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const queues = useQuery(operatorQueuesOptions(user.id))
  const [selectedService, setSelectedService] = useState('')
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const selected =
    queues.data?.find((queue) => queue.serviceId === selectedService) ?? queues.data?.[0]
  const queue = useQuery(
    operatorQueueOptions(user.id, selected?.branchId ?? '', selected?.serviceId ?? ''),
  )

  async function refresh() {
    setMessage('')
    setRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: operatorQueuesOptions(user.id).queryKey }),
        queryClient.invalidateQueries({ queryKey: ['operator', user.id, 'queue'] }),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  const command = useMutation({
    mutationFn: async (action: Action) => {
      if (!selected) throw new Error('Choose a queue first.')
      if (action === 'call-next')
        return callNext({ data: { branchId: selected.branchId, serviceId: selected.serviceId } })
      if (!queue.data?.current) throw new Error('Refresh the queue to see your current ticket.')
      return updateOperatorTicket({ data: { action, ticketId: queue.data.current.id } })
    },
    onMutate: () => setMessage(''),
    onSuccess: async (ticket, action) => {
      await refresh()
      setMessage(
        action === 'call-next'
          ? ticket
            ? `Ticket ${ticket.ticketNumber} called.`
            : 'No customers are waiting.'
          : action === 'start'
            ? 'Service started.'
            : action === 'complete'
              ? 'Service completed.'
              : 'Ticket skipped.',
      )
    },
    onError: async () => {
      await refresh()
    },
  })

  return (
    <AuthenticatedShell currentSection="operator" user={user}>
      <div className="space-y-8">
        <header>
          <div>
            <PageHeading className="text-3xl font-semibold tracking-tight">
              Operator queue
            </PageHeading>
            <p className="mt-2 text-sm text-muted-foreground">
              Review the waiting list and guide each ticket through service.
            </p>
          </div>
        </header>
        {queues.isPending ? (
          <LoadingMessage>Loading your queues…</LoadingMessage>
        ) : queues.isError ? (
          <div className="space-y-4">
            <FeedbackMessage kind="error">{queues.error.message}</FeedbackMessage>
            <Button
              aria-disabled={queues.isFetching}
              className="min-h-11 px-4 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              variant="outline"
              onClick={() => {
                if (!queues.isFetching) void queues.refetch()
              }}
            >
              {queues.isFetching ? 'Retrying…' : 'Try again'}
            </Button>
          </div>
        ) : queues.data.length === 0 ? (
          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-medium">No assigned queues</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No queues are assigned to you. Contact your branch administrator for access.
            </p>
          </section>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:gap-7">
            <nav aria-label="Assigned queues" className="p-0">
              <div className="mb-4">
                <h2 className="text-base font-semibold">Your queues</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose a service to manage.</p>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {queues.data.map((item) => (
                  <li key={item.serviceId}>
                    <button
                      type="button"
                      aria-pressed={selected?.serviceId === item.serviceId}
                      onClick={() => {
                        setSelectedService(item.serviceId)
                        setMessage('')
                        command.reset()
                      }}
                      className={`min-h-28 w-full rounded-lg border p-4 text-left transition-colors duration-200 hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected?.serviceId === item.serviceId ? 'border-brand-accent bg-background' : 'bg-background'}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{item.serviceName}</span>
                          <span className="mt-1 block truncate text-sm text-muted-foreground">
                            {item.branchName}
                          </span>
                        </span>
                        {selected?.serviceId === item.serviceId ? (
                          <span className="shrink-0 text-xs font-medium text-foreground">
                            Selected
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-sm">
                        <span className="text-muted-foreground">Waiting</span>
                        <span className="font-semibold tabular-nums">{item.waitingCount ?? 0}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            {queue.isPending ? (
              <LoadingMessage>Loading queue…</LoadingMessage>
            ) : queue.isError ? (
              <div className="space-y-4">
                <FeedbackMessage kind="error">{queue.error.message}</FeedbackMessage>
                <Button
                  aria-disabled={queue.isFetching}
                  className="min-h-11 px-4 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  variant="outline"
                  onClick={() => {
                    if (!queue.isFetching) void queue.refetch()
                  }}
                >
                  {queue.isFetching ? 'Retrying…' : 'Try again'}
                </Button>
              </div>
            ) : queue.data ? (
              <OperatorQueue
                detail={queue.data}
                busy={command.isPending}
                refreshing={refreshing}
                pendingAction={command.isPending ? (command.variables ?? null) : null}
                message={message}
                error={
                  command.error ? `${command.error.message} Refresh the queue and try again.` : ''
                }
                onAction={(action) => command.mutate(action)}
                onRefresh={() => {
                  void refresh()
                }}
              />
            ) : null}
          </div>
        )}
      </div>
    </AuthenticatedShell>
  )
}
