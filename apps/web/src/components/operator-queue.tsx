import {
  ArrowRightLeft,
  Check,
  CircleCheck,
  Layers3,
  ListOrdered,
  MapPin,
  PhoneCall,
  Play,
  RefreshCw,
  SkipForward,
  Ticket,
  UsersRound,
} from 'lucide-react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { useCallback, useRef } from 'react'
import type { components } from '@/client/api/schema'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
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
  onHandoff?: (source: HTMLButtonElement) => void
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
  onHandoff,
}: Props) {
  const { current, waiting } = detail
  const restoreActionFocusRef = useRef<HTMLElement | null>(null)
  const focusTargetRef = useCallback(
    (target: HTMLElement | null) => {
      const source = restoreActionFocusRef.current
      if (!target || busy || !source || !target.isConnected) return
      if (target instanceof HTMLButtonElement && target.disabled) return

      const activeElement = document.activeElement
      if (activeElement === document.body || activeElement === source || activeElement === target) {
        target.focus({ preventScroll: true })
      }
      restoreActionFocusRef.current = null
    },
    [busy],
  )
  const prefersReducedMotion = usePrefersReducedMotion()
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

  function handleAction(action: Action, source: HTMLButtonElement) {
    if (busy) return
    restoreActionFocusRef.current = document.activeElement === source ? source : null
    onAction(action)
  }

  function handleHandoff(source: HTMLButtonElement) {
    if (busy) return
    restoreActionFocusRef.current = document.activeElement === source ? source : null
    onHandoff?.(source)
  }

  function handleRefresh() {
    if (!busy && !refreshing) onRefresh()
  }

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={`operator-queue-${detail.queue.serviceId}`}>
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)] lg:gap-7">
          <section
            aria-labelledby="current-ticket-heading"
            className="min-w-0 rounded-lg border bg-card p-5 sm:p-7"
          >
            <header className="flex flex-wrap items-end justify-between gap-5">
              <div className="min-w-0">
                <h2
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                  id="current-ticket-heading"
                >
                  <Ticket aria-hidden="true" size={16} />
                  Current ticket
                </h2>
                <p className="mt-1 flex items-center gap-2 truncate text-xl font-semibold tracking-tight">
                  <Layers3
                    aria-hidden="true"
                    className="shrink-0 text-muted-foreground"
                    size={18}
                  />
                  {detail.queue.serviceName}
                </p>
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <MapPin aria-hidden="true" size={14} />
                  {detail.queue.branchName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <p className="text-right">
                  <span className="flex items-center justify-end gap-1.5 text-2xl font-semibold tabular-nums leading-none">
                    <UsersRound aria-hidden="true" className="text-muted-foreground" size={16} />
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                        key={waiting.length}
                        transition={motionTransition}
                      >
                        {waiting.length}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">waiting</span>
                </p>
                <Button
                  className="min-h-12 px-4"
                  disabled={busy || refreshing}
                  variant="outline"
                  onClick={handleRefresh}
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={refreshing ? 'animate-spin motion-reduce:animate-none' : undefined}
                  />
                  {refreshing ? 'Refreshing…' : 'Refresh queue'}
                </Button>
              </div>
            </header>

            <div className="mt-7 border-t pt-7">
              <AnimatePresence initial={false}>
                {current ? (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
                    exit={motionExit}
                    initial={motionInitial}
                    key={current.id}
                    layout={!prefersReducedMotion}
                    layoutId={`ticket-${current.id}`}
                    transition={motionTransition}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        {current.status === 'OPERATING' ? 'Now serving' : 'Called ticket'}
                      </p>
                      <p
                        className="mt-2 break-words font-mono text-6xl font-semibold tabular-nums tracking-[-0.06em] sm:text-7xl"
                        data-testid="operator-current-ticket"
                      >
                        {current.ticketNumber}
                      </p>
                      <div className="mt-4">
                        <TicketStatus status={current.status} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-3">
                      {current.status === 'PENDING' ? (
                        <>
                          <Button
                            className="min-h-12 px-5"
                            disabled={busy}
                            onClick={(event) => handleAction('start', event.currentTarget)}
                            ref={focusTargetRef}
                          >
                            <Play aria-hidden="true" />
                            Start service
                          </Button>
                          <Button
                            className="min-h-12 px-5"
                            disabled={busy}
                            variant="outline"
                            onClick={(event) => handleAction('skip', event.currentTarget)}
                          >
                            <SkipForward aria-hidden="true" />
                            Skip ticket
                          </Button>
                          {onHandoff ? (
                            <Button
                              className="min-h-12 px-5"
                              disabled={busy}
                              variant="outline"
                              onClick={(event) => handleHandoff(event.currentTarget)}
                            >
                              <ArrowRightLeft aria-hidden="true" />
                              Transfer ticket
                            </Button>
                          ) : null}
                        </>
                      ) : current.status === 'OPERATING' ? (
                        <>
                          <Button
                            className="min-h-12 px-5"
                            disabled={busy}
                            onClick={(event) => handleAction('complete', event.currentTarget)}
                            ref={focusTargetRef}
                          >
                            <Check aria-hidden="true" />
                            Complete service
                          </Button>
                          {onHandoff ? (
                            <Button
                              className="min-h-12 px-5"
                              disabled={busy}
                              variant="outline"
                              onClick={(event) => handleHandoff(event.currentTarget)}
                            >
                              <ArrowRightLeft aria-hidden="true" />
                              Transfer ticket
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </motion.div>
                ) : waiting.length > 0 ? (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between"
                    exit={motionExit}
                    initial={motionInitial}
                    key="ready-for-next"
                    transition={motionTransition}
                  >
                    <div>
                      <p className="font-semibold">Ready for the next customer</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {waiting.length} {waiting.length === 1 ? 'ticket is' : 'tickets are'}{' '}
                        waiting.
                      </p>
                    </div>
                    <Button
                      className="min-h-12 w-full px-5 sm:w-auto"
                      disabled={busy}
                      onClick={(event) => handleAction('call-next', event.currentTarget)}
                      ref={focusTargetRef}
                    >
                      <PhoneCall aria-hidden="true" />
                      Call next
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="py-1"
                    exit={motionExit}
                    initial={motionInitial}
                    key="queue-empty"
                    transition={motionTransition}
                  >
                    <p
                      className="flex items-center gap-2 font-semibold"
                      ref={focusTargetRef}
                      tabIndex={-1}
                    >
                      <CircleCheck aria-hidden="true" className="text-muted-foreground" size={19} />
                      No customers are waiting.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      New tickets will appear here when customers join this queue.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {pendingAction ? (
              <div className="mt-6">
                <LoadingMessage>{pendingMessage[pendingAction]}</LoadingMessage>
              </div>
            ) : refreshing ? (
              <div className="mt-6">
                <LoadingMessage>Refreshing queue…</LoadingMessage>
              </div>
            ) : null}
            {message ? (
              <div className="mt-6">
                <FeedbackMessage kind="success">{message}</FeedbackMessage>
              </div>
            ) : null}
            {error ? (
              <div className="mt-6">
                <FeedbackMessage kind="error">{error}</FeedbackMessage>
              </div>
            ) : null}
          </section>

          <section
            aria-labelledby="waiting-tickets-heading"
            className="min-w-0 lg:border-l lg:pl-7"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2
                className="flex items-center gap-2 text-lg font-semibold tracking-tight"
                id="waiting-tickets-heading"
              >
                <ListOrdered aria-hidden="true" size={19} />
                Waiting list
              </h2>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {waiting.length} {waiting.length === 1 ? 'ticket' : 'tickets'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Customers are served in this order.
            </p>
            <AnimatePresence initial={false} mode="wait">
              {waiting.length === 0 ? (
                <motion.p
                  animate={{ opacity: 1 }}
                  className="mt-5 text-sm text-muted-foreground"
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
                  className="mt-4 divide-y border-y"
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
                      aria-posinset={index + 1}
                      aria-setsize={waiting.length}
                      layout={!prefersReducedMotion}
                      layoutId={`ticket-${ticket.id}`}
                      transition={motionTransition}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center border-r border-border pr-3 font-mono text-sm font-medium tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="truncate font-mono font-semibold tabular-nums">
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
