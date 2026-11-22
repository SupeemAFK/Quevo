import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
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
  const nextActionRef = useRef<HTMLButtonElement>(null)
  const emptyCurrentRef = useRef<HTMLParagraphElement>(null)
  const lastMessageRef = useRef('')
  const prefersReducedMotion = useReducedMotion() ?? false
  const motionTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: 'easeOut' as const }
  const motionInitial = prefersReducedMotion ? false : { opacity: 0 }
  const motionExit = prefersReducedMotion ? undefined : { opacity: 0 }
  const pendingMessage: Record<Action, string> = {
    'call-next': 'Calling the next customer…',
    start: 'Starting service…',
    complete: 'Completing service…',
    skip: 'Skipping ticket…',
  }

  useEffect(() => {
    if (!message) {
      lastMessageRef.current = ''
      return
    }
    if (lastMessageRef.current === message) return
    lastMessageRef.current = message
    const nextAction = nextActionRef.current
    const hasActionToFocus = current
      ? Boolean(nextAction && !nextAction.disabled)
      : waiting.length > 0
    if (hasActionToFocus && nextAction && !nextAction.disabled) {
      nextAction.focus()
    } else {
      emptyCurrentRef.current?.focus()
    }
  }, [current, message, waiting.length])

  function handleAction(action: Action) {
    if (!busy) onAction(action)
  }

  function handleRefresh() {
    if (!busy && !refreshing) onRefresh()
  }

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={`operator-queue-${detail.queue.serviceId}`}>
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
                  {detail.queue.serviceName} <span aria-hidden="true">·</span>{' '}
                  {detail.queue.branchName}
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
                  aria-disabled={busy || refreshing}
                  className="min-h-11 px-4 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  variant="outline"
                  onClick={handleRefresh}
                >
                  Refresh queue
                </Button>
              </div>
            </header>

            <div className="p-5 sm:p-7">
              <AnimatePresence initial={false}>
                {current ? (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
                    exit={motionExit}
                    initial={motionInitial}
                    key={current.id}
                    layout={!prefersReducedMotion}
                    layoutId={`ticket-${current.id}`}
                    transition={motionTransition}
                  >
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
                            aria-disabled={busy}
                            className="min-h-11 px-5 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                            onClick={() => handleAction('start')}
                            ref={nextActionRef}
                          >
                            Start service
                          </Button>
                          <Button
                            aria-disabled={busy}
                            variant="outline"
                            className="min-h-11 px-5 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                            onClick={() => handleAction('skip')}
                          >
                            Skip ticket
                          </Button>
                        </>
                      ) : null}
                      {current.status === 'OPERATING' ? (
                        <Button
                          aria-disabled={busy}
                          className="min-h-11 px-5 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                          onClick={() => handleAction('complete')}
                          ref={nextActionRef}
                        >
                          Complete service
                        </Button>
                      ) : null}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between"
                    exit={motionExit}
                    initial={motionInitial}
                    key="no-current-ticket"
                    transition={motionTransition}
                  >
                    <div>
                      <p className="font-semibold" ref={emptyCurrentRef} tabIndex={-1}>
                        You have no current ticket.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {waiting.length > 0
                          ? 'Call the next customer when you are ready.'
                          : 'New customers will appear here when they join this queue.'}
                      </p>
                    </div>
                    <Button
                      aria-disabled={busy || waiting.length === 0}
                      className="min-h-11 w-full px-5 sm:w-auto aria-disabled:pointer-events-none aria-disabled:opacity-50"
                      disabled={waiting.length === 0}
                      onClick={() => handleAction('call-next')}
                      ref={nextActionRef}
                    >
                      Call next
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

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

          <section
            aria-labelledby="waiting-tickets"
            className="rounded-2xl border bg-card p-5 sm:p-6"
          >
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
            <AnimatePresence initial={false} mode="wait">
              {waiting.length === 0 ? (
                <motion.p
                  animate={{ opacity: 1 }}
                  className="mt-4 rounded-xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground"
                  exit={motionExit}
                  initial={motionInitial}
                  key="empty-waiting-list"
                  transition={motionTransition}
                >
                  No customers are waiting in this queue.
                </motion.p>
              ) : (
                <motion.ol
                  animate={{ opacity: 1 }}
                  aria-label="Customers waiting in order"
                  className="mt-4 divide-y"
                  exit={motionExit}
                  initial={motionInitial}
                  key="waiting-list"
                  layout={!prefersReducedMotion}
                  transition={motionTransition}
                >
                  {waiting.map((ticket, index) => (
                    <motion.li
                      animate={{ opacity: 1 }}
                      className="flex min-h-16 items-center justify-between gap-4 py-3"
                      exit={motionExit}
                      initial={motionInitial}
                      key={ticket.id}
                      layout={!prefersReducedMotion}
                      layoutId={`ticket-${ticket.id}`}
                      transition={motionTransition}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium tabular-nums">
                          {index + 1}
                        </span>
                        <span className="truncate font-semibold tabular-nums">
                          Ticket {ticket.ticketNumber}
                        </span>
                      </span>
                      <TicketStatus status={ticket.status} />
                    </motion.li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </section>
        </div>
      </LayoutGroup>
    </MotionConfig>
  )
}
