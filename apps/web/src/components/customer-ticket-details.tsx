import { RefreshCw } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
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

const statusGuidance: Record<string, string> = {
  WAITING: "You're in the queue. Keep this page open or check back for updates.",
  PENDING: "It's your turn. Please go to the service desk now.",
  OPERATING: 'Your service is in progress. Stay with the operator.',
  COMPLETED: 'Your service is complete.',
  SKIPPED: 'This ticket was skipped. Please speak with the service desk for guidance.',
}

export function CustomerTicketDetails({ ticket, refreshing, feedback, onRefresh }: Props) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const guidance =
    statusGuidance[ticket.status] ?? 'Refresh this page to check your ticket status again.'

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-muted-foreground">{ticket.serviceName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Status updates load when you open this page. Refresh to check again.
            </p>
          </div>
          <Button
            className="min-h-11 px-4"
            disabled={refreshing}
            onClick={() => {
              if (!refreshing) onRefresh()
            }}
            variant="outline"
          >
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? 'animate-spin motion-reduce:animate-none' : undefined}
            />
            {refreshing ? 'Refreshing…' : 'Refresh status'}
          </Button>
        </div>

        <section
          aria-labelledby="ticket-number-heading"
          className="rounded-lg border bg-card p-5 sm:p-8"
        >
          <p className="text-sm font-medium text-muted-foreground" id="ticket-number-heading">
            Your ticket number
          </p>
          <p
            className="mt-2 break-words font-mono text-6xl font-semibold tabular-nums tracking-[-0.06em] sm:text-7xl"
            data-testid="ticket-number"
          >
            {ticket.ticketNumber}
          </p>

          <div className="mt-7 border-t pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Current status</span>
              <TicketStatus status={ticket.status} />
            </div>
            <AnimatePresence initial={false}>
              <motion.p
                aria-atomic="true"
                aria-live="polite"
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 max-w-2xl leading-6"
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                initial={false}
                key={ticket.status}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16 }}
              >
                {guidance}
              </motion.p>
            </AnimatePresence>
          </div>

          <dl className="mt-7 grid grid-cols-1 gap-x-6 gap-y-4 border-t pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Branch</dt>
              <dd className="mt-1 font-medium">{ticket.branchName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Business date</dt>
              <dd className="mt-1 font-medium">{ticket.businessDate}</dd>
            </div>
          </dl>
        </section>

        {refreshing ? <LoadingMessage>Refreshing ticket status…</LoadingMessage> : null}
        {feedback ? (
          <FeedbackMessage kind={feedback.kind}>{feedback.message}</FeedbackMessage>
        ) : null}
      </div>
    </MotionConfig>
  )
}
