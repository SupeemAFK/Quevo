import type { components } from '@/client/api/schema'
import { Button } from './ui/button'

type QueueDetail = components['schemas']['queue.OperatorQueueDetailResponse']
type Action = 'call-next' | 'start' | 'complete' | 'skip'

type Props = {
  detail: QueueDetail
  busy: boolean
  message: string
  error: string
  onAction: (action: Action) => void
  onRefresh: () => void
}

export function OperatorQueue({ detail, busy, message, error, onAction, onRefresh }: Props) {
  const { current, waiting } = detail
  return (
    <div className="space-y-6">
      <section aria-labelledby="current-ticket" className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="current-ticket" className="text-lg font-semibold">
              Current ticket
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.queue.serviceName} at {detail.queue.branchName}
            </p>
          </div>
          <Button variant="outline" disabled={busy} onClick={onRefresh}>
            Refresh queue
          </Button>
        </div>
        {current ? (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">Now serving</p>
            <p
              className="mt-1 text-5xl font-semibold tabular-nums"
              data-testid="operator-current-ticket"
            >
              {current.ticketNumber}
            </p>
            <p className="mt-2 text-sm font-medium" role="status">
              {current.status === 'PENDING' ? 'Called' : 'In service'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {current.status === 'PENDING' ? (
                <>
                  <Button disabled={busy} onClick={() => onAction('start')}>
                    Start service
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => onAction('skip')}>
                    Skip ticket
                  </Button>
                </>
              ) : null}
              {current.status === 'OPERATING' ? (
                <Button disabled={busy} onClick={() => onAction('complete')}>
                  Complete service
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">You have no current ticket.</p>
            <Button disabled={busy || waiting.length === 0} onClick={() => onAction('call-next')}>
              Call next
            </Button>
          </div>
        )}
        {message ? (
          <p className="mt-4 text-sm" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="waiting-tickets" className="rounded-xl border bg-card p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="waiting-tickets" className="text-lg font-semibold">
            Waiting
          </h2>
          <span className="text-sm text-muted-foreground">
            {waiting.length} {waiting.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>
        {waiting.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No customers are waiting in this queue.
          </p>
        ) : (
          <ol className="mt-4 divide-y">
            {waiting.map((ticket) => (
              <li className="flex items-center justify-between gap-4 py-3" key={ticket.id}>
                <span className="font-medium tabular-nums">Ticket {ticket.ticketNumber}</span>
                <span className="text-sm text-muted-foreground">Waiting</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
