import { RefreshCw } from 'lucide-react'
import type { components } from '@/client/api/schema'
import { FeedbackMessage, LoadingMessage } from './feedback-message'
import { TicketStatus } from './ticket-status'
import { Button } from './ui/button'

type Ticket = components['schemas']['queue.TicketResponse']
type Feedback = { message: string; kind: 'success' | 'error' } | null

type Props = {
  ticket: Ticket
  refreshing: boolean
  feedback: Feedback
  onRefresh: () => void
}

export function CustomerTicketDetails({ ticket, refreshing, feedback, onRefresh }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Your queue ticket</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest status is loaded when you open this page. Refresh when you want to check again.
          </p>
        </div>
        <Button
          className="min-h-11 px-4"
          disabled={refreshing}
          onClick={onRefresh}
          variant="outline"
        >
          <RefreshCw
            aria-hidden="true"
            className={refreshing ? 'animate-spin motion-reduce:animate-none' : undefined}
          />
          Refresh status
        </Button>
      </div>

      <section
        aria-labelledby="ticket-number-heading"
        className="rounded-2xl border bg-muted/30 p-5 sm:p-8"
      >
        <p className="text-sm font-medium text-muted-foreground" id="ticket-number-heading">
          Ticket number
        </p>
        <p
          className="mt-1 break-words text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl"
          data-testid="ticket-number"
        >
          {ticket.ticketNumber}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
          <p className="text-sm font-medium text-muted-foreground">Current status</p>
          <TicketStatus status={ticket.status} />
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t pt-5 text-sm sm:grid-cols-[minmax(7rem,auto)_1fr]">
          <dt className="text-muted-foreground">Service</dt>
          <dd className="font-medium">{ticket.serviceName}</dd>
          <dt className="text-muted-foreground">Branch</dt>
          <dd className="font-medium">{ticket.branchName}</dd>
          <dt className="text-muted-foreground">Business date</dt>
          <dd className="font-medium">{ticket.businessDate}</dd>
        </dl>
      </section>

      {refreshing ? <LoadingMessage>Refreshing ticket status…</LoadingMessage> : null}
      {feedback ? <FeedbackMessage kind={feedback.kind}>{feedback.message}</FeedbackMessage> : null}
    </div>
  )
}
