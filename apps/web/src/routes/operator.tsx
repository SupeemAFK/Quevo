import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { OperatorQueue } from '@/components/operator-queue'
import { OperatorServiceNavigation } from '@/components/operator-service-navigation'
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

function queueKey(queue: { branchId: string; serviceId: string }) {
  return `${queue.branchId}:${queue.serviceId}`
}

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
  const [selectedQueueID, setSelectedQueueID] = useState('')
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const selected =
    queues.data?.find((queue) => queueKey(queue) === selectedQueueID) ?? queues.data?.[0]
  const multipleQueues = (queues.data?.length ?? 0) > 1
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

  function selectQueue(id: string) {
    setSelectedQueueID(id)
    setMessage('')
    command.reset()
  }

  return (
    <AuthenticatedShell currentSection="operator" user={user}>
      <div className="space-y-8">
        <header>
          <PageHeading className="text-3xl font-semibold tracking-tight">
            Operator queue
          </PageHeading>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Call the next customer, manage the service in progress, and follow the waiting order.
          </p>
        </header>

        {queues.isPending ? (
          <LoadingMessage>Loading your queues…</LoadingMessage>
        ) : queues.isError ? (
          <div className="space-y-4">
            <FeedbackMessage kind="error">{queues.error.message}</FeedbackMessage>
            <Button
              className="min-h-11 px-4"
              disabled={queues.isFetching}
              variant="outline"
              onClick={() => {
                if (!queues.isFetching) void queues.refetch()
              }}
            >
              {queues.isFetching ? 'Retrying…' : 'Try again'}
            </Button>
          </div>
        ) : queues.data.length === 0 ? (
          <section className="border-y py-5">
            <h2 className="font-semibold">No assigned queues</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No queues are assigned to you. Contact your branch administrator for access.
            </p>
          </section>
        ) : (
          <div
            className={
              multipleQueues
                ? 'grid min-w-0 gap-7 lg:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)]'
                : 'min-w-0'
            }
          >
            {multipleQueues && selected ? (
              <OperatorServiceNavigation
                onSelect={(item) => selectQueue(queueKey(item))}
                queues={queues.data}
                selectedQueueKey={queueKey(selected)}
              />
            ) : null}

            <div className="min-w-0">
              {queue.isPending ? (
                <LoadingMessage>Loading queue…</LoadingMessage>
              ) : queue.isError ? (
                <div className="space-y-4">
                  <FeedbackMessage kind="error">{queue.error.message}</FeedbackMessage>
                  <Button
                    className="min-h-11 px-4"
                    disabled={queue.isFetching}
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
                    command.reset()
                    void refresh()
                  }}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AuthenticatedShell>
  )
}
