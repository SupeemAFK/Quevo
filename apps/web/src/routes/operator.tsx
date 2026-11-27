import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Inbox, PanelsTopLeft, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { OperatorQueue } from '@/components/operator-queue'
import { OperatorServiceNavigation } from '@/components/operator-service-navigation'
import { PageHeading } from '@/components/page-heading'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import {
  applyOperatorTicketUpdate,
  callNext,
  operatorQueueOptions,
  operatorQueuesOptions,
  updateOperatorTicket,
} from '@/lib/operator-queue'
import { usePageActivity } from '@/lib/use-page-activity'

type Action = 'call-next' | 'start' | 'complete' | 'skip' | 'no-show'

function queueKey(queue: { branchId: string; queueId: string }) {
  return `${queue.branchId}:${queue.queueId}`
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
  const pageActive = usePageActivity()
  const queues = useQuery({
    ...operatorQueuesOptions(user.id),
    refetchInterval: pageActive ? 10_000 : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
  const [selectedQueueID, setSelectedQueueID] = useState('')
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const selected =
    queues.data?.find((queue) => queueKey(queue) === selectedQueueID) ?? queues.data?.[0]
  const multipleQueues = (queues.data?.length ?? 0) > 1
  const queue = useQuery({
    ...operatorQueueOptions(user.id, selected?.branchId ?? '', selected?.queueId ?? ''),
    refetchInterval: pageActive ? 10_000 : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

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

  function refreshInBackground() {
    void queryClient.invalidateQueries({ queryKey: operatorQueuesOptions(user.id).queryKey })
    void queryClient.invalidateQueries({ queryKey: ['operator', user.id, 'queue'] })
  }

  const command = useMutation({
    mutationFn: async (action: Action) => {
      if (!selected) throw new Error('Choose a queue first.')
      if (action === 'call-next')
        return callNext({ data: { branchId: selected.branchId, queueId: selected.queueId } })
      if (!queue.data?.current) throw new Error('Refresh the queue to see your current ticket.')
      return updateOperatorTicket({ data: { action, ticketId: queue.data.current.id } })
    },
    onMutate: () => setMessage(''),
    onSuccess: (ticket, action) => {
      if (selected) {
        queryClient.setQueryData(
          operatorQueueOptions(user.id, selected.branchId, selected.queueId).queryKey,
          (current) => applyOperatorTicketUpdate(current, ticket, action),
        )
        if (action === 'call-next' && ticket) {
          queryClient.setQueryData(operatorQueuesOptions(user.id).queryKey, (current) =>
            current?.map((item) =>
              queueKey(item) === queueKey(selected)
                ? { ...item, waitingCount: Math.max(0, (item.waitingCount ?? 0) - 1) }
                : item,
            ),
          )
        }
      }
      refreshInBackground()
      setMessage(
        action === 'call-next'
          ? ticket
            ? `Ticket ${ticket.ticketNumber} called.`
            : 'No customers are waiting.'
          : action === 'start'
            ? 'Service started.'
            : action === 'complete'
              ? 'Service completed.'
              : action === 'skip'
                ? 'Ticket skipped.'
                : 'Ticket marked no-show.',
      )
    },
    onError: () => {
      refreshInBackground()
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
          <PageHeading className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <PanelsTopLeft aria-hidden="true" size={26} />
            Operator queue
          </PageHeading>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Call the next customer, manage the service in progress, and follow the waiting order.
          </p>
        </header>

        {queues.isPending ? (
          <LoadingMessage>Loading your queues…</LoadingMessage>
        ) : !queues.data && queues.isError ? (
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
              <RefreshCw
                aria-hidden="true"
                className={
                  queues.isFetching ? 'animate-spin motion-reduce:animate-none' : undefined
                }
              />
              {queues.isFetching ? 'Retrying…' : 'Try again'}
            </Button>
          </div>
        ) : !queues.data || queues.data.length === 0 ? (
          <>
            {queues.isRefetchError ? (
              <FeedbackMessage kind="error">
                Could not refresh your assigned queues. Showing the last loaded view. Use Refresh
                queue to retry.
              </FeedbackMessage>
            ) : null}
            <section className="border-y py-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Inbox aria-hidden="true" size={18} />
                No assigned queues
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No queues are assigned to you. Contact your branch administrator for access.
              </p>
            </section>
          </>
        ) : (
          <div
            className={
              multipleQueues
                ? 'grid min-w-0 gap-7 lg:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)]'
                : 'min-w-0'
            }
          >
            {queues.isRefetchError ? (
              <FeedbackMessage kind="error">
                Could not refresh your assigned queues. Showing the last loaded view; retry using
                Refresh queue.
              </FeedbackMessage>
            ) : null}
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
              ) : !queue.data && queue.isError ? (
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
                    <RefreshCw
                      aria-hidden="true"
                      className={
                        queue.isFetching ? 'animate-spin motion-reduce:animate-none' : undefined
                      }
                    />
                    {queue.isFetching ? 'Retrying…' : 'Try again'}
                  </Button>
                </div>
              ) : queue.data ? (
                <OperatorQueue
                  operatorId={user.id}
                  detail={queue.data}
                  busy={command.isPending}
                  refreshing={refreshing}
                  pendingAction={command.isPending ? (command.variables ?? null) : null}
                  message={message}
                  error={
                    command.error
                      ? `${command.error.message} Refresh the queue and try again.`
                      : queue.isRefetchError
                        ? 'Could not sync the latest queue. Showing the last saved state; use Refresh queue to retry.'
                        : ''
                  }
                  onAction={(action) => command.mutate(action)}
                  onRefresh={() => {
                    command.reset()
                    void refresh()
                  }}
                  onHandoff={(operatorName) => {
                    setMessage(`Ticket handed off to ${operatorName}.`)
                    refreshInBackground()
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
