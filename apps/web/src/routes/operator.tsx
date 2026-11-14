import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { OperatorQueue } from '@/components/operator-queue'
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
  const selected =
    queues.data?.find((queue) => queue.serviceId === selectedService) ?? queues.data?.[0]
  const queue = useQuery(
    operatorQueueOptions(user.id, selected?.branchId ?? '', selected?.serviceId ?? ''),
  )

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: operatorQueuesOptions(user.id).queryKey }),
      queryClient.invalidateQueries({ queryKey: ['operator', user.id, 'queue'] }),
    ])
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
    <main className="mx-auto min-h-svh max-w-5xl px-6 py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Operator queue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Call customers and keep service moving.
          </p>
        </div>
        <Link className="text-sm underline-offset-4 hover:underline" to="/">
          Back to Quevo
        </Link>
      </header>
      {queues.isPending ? (
        <p role="status">Loading your queues…</p>
      ) : queues.isError ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-destructive">
            {queues.error.message}
          </p>
          <Button variant="outline" onClick={() => queues.refetch()}>
            Try again
          </Button>
        </div>
      ) : queues.data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No queues are assigned to you.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
          <nav aria-label="Assigned queues" className="space-y-2">
            <h2 className="mb-3 text-sm font-medium">Your queues</h2>
            {queues.data.map((item) => (
              <button
                key={item.serviceId}
                type="button"
                aria-pressed={selected?.serviceId === item.serviceId}
                onClick={() => {
                  setSelectedService(item.serviceId)
                  setMessage('')
                  command.reset()
                }}
                className={`w-full rounded-lg border p-4 text-left ${selected?.serviceId === item.serviceId ? 'border-primary bg-muted' : 'bg-card hover:bg-muted/50'}`}
              >
                <span className="block font-medium">{item.serviceName}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{item.branchName}</span>
                <span className="mt-3 block text-sm tabular-nums">
                  {item.waitingCount ?? 0} waiting
                </span>
              </button>
            ))}
          </nav>
          {queue.isPending ? (
            <p role="status">Loading queue…</p>
          ) : queue.isError ? (
            <div className="space-y-4">
              <p role="alert" className="text-sm text-destructive">
                {queue.error.message}
              </p>
              <Button variant="outline" onClick={() => queue.refetch()}>
                Try again
              </Button>
            </div>
          ) : queue.data ? (
            <OperatorQueue
              detail={queue.data}
              busy={command.isPending}
              message={message}
              error={command.error?.message ?? ''}
              onAction={(action) => command.mutate(action)}
              onRefresh={() => {
                void refresh()
              }}
            />
          ) : null}
        </div>
      )}
    </main>
  )
}
