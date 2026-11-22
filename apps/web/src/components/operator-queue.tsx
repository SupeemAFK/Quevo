import type { components } from '@/client/api/schema'
import { FeedbackMessage, LoadingMessage } from './feedback-message'
import { TicketStatus } from './ticket-status'
import { Button } from './ui/button'

type QueueDetail = components['schemas']['queue.OperatorQueueDetailResponse']
type Action = 'call-next' | 'start' | 'complete' | 'skip'

type Props = {
  detail: QueueDetail
  busy: boolean
  refreshing: boolean
  pendingAction: Action | null
  message: string
  error: string
  onAction: (action: Action) => void
  onRefresh: () => void
}

export function OperatorQueue({
  detail,
  busy,
  refreshing,
  pendingAction,
  message,
  error,
  onAction,
  onRefresh,
}: Props) {
  const { current, waiting } = detail
  const pendingMessage: Record<Action, string> = {
    'call-next': 'Calling the next customer…',
    start: 'Starting service…',
    complete: 'Completing service…',
    skip: 'Skipping ticket…',
  }
  return (
    <div className="space-y-5">
      <section
        aria-labelledby="current-ticket"
        className="overflow-hidden rounded-2xl border bg-card"
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-muted/30 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" id="current-ticket">
              Current ticket
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.queue.serviceName} <span aria-hidden="true">·</span> {detail.queue.branchName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border bg-background px-3 py-2 text-right">
              <span className="block text-xs font-medium text-muted-foreground">Waiting</span>
              <span className="block text-lg font-semibold tabular-nums leading-tight">
                {waiting.length}
              </span>
            </div>
            <Button
              className="min-h-11 px-4"
              variant="outline"
              disabled={busy || refreshing}
              onClick={onRefresh}
            >
              Refresh queue
            </Button>
          </div>
        </header>

        <div className="p-5 sm:p-7">
          {current ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Now serving</p>
                <p
                  className="mt-1 text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl"
                  data-testid="operator-current-ticket"
                >
                  {current.ticketNumber}
                </p>
                <div className="mt-3">
                  <TicketStatus status={current.status} />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {current.status === 'PENDING' ? (
                  <>
                    <Button
                      className="min-h-11 px-5"
                      disabled={busy}
                      onClick={() => onAction('start')}
                    >
                      Start service
                    </Button>
                    <Button
                      className="min-h-11 px-5"
                      variant="outline"
                      disabled={busy}
                      onClick={() => onAction('skip')}
                    >
                      Skip ticket
                    </Button>
                  </>
                ) : null}
                {current.status === 'OPERATING' ? (
                  <Button
                    className="min-h-11 px-5"
                    disabled={busy}
                    onClick={() => onAction('complete')}
                  >
                    Complete service
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">You have no current ticket.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {waiting.length > 0
                    ? 'Call the next customer when you are ready.'
                    : 'New customers will appear here when they join this queue.'}
                </p>
              </div>
              <Button
                className="min-h-11 w-full px-5 sm:w-auto"
                disabled={busy || waiting.length === 0}
                onClick={() => onAction('call-next')}
              >
                Call next
              </Button>
            </div>
          )}

          {pendingAction ? (
            <div className="mt-5">
              <LoadingMessage>{pendingMessage[pendingAction]}</LoadingMessage>
            </div>
          ) : refreshing ? (
            <div className="mt-5">
              <LoadingMessage>Refreshing queue…</LoadingMessage>
            </div>
          ) : null}
          {message ? (
            <div className="mt-5">
              <FeedbackMessage kind="success">{message}</FeedbackMessage>
            </div>
          ) : null}
          {error ? (
            <div className="mt-5">
              <FeedbackMessage kind="error">{error}</FeedbackMessage>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="waiting-tickets" className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" id="waiting-tickets">
              Waiting list
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Customers are served in this order.
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium tabular-nums">
            {waiting.length} {waiting.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>
        {waiting.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            No customers are waiting in this queue.
          </p>
        ) : (
          <ol aria-label="Customers waiting in order" className="mt-4 divide-y">
            {waiting.map((ticket, index) => (
              <li className="flex min-h-16 items-center justify-between gap-4 py-3" key={ticket.id}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium tabular-nums">
                    {index + 1}
                  </span>
                  <span className="truncate font-semibold tabular-nums">
                    Ticket {ticket.ticketNumber}
                  </span>
                </span>
                <TicketStatus status={ticket.status} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
