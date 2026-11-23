import { useQuery } from '@tanstack/react-query'
import {
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
  UserX,
} from 'lucide-react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import type { components } from '@/client/api/schema'
import { getOperatorTicketHistory } from '@/lib/operator-queue'
import { ticketDocumentsOptions } from '@/lib/ticket-documents'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
import { FeedbackMessage, LoadingMessage } from './feedback-message'
import { TicketStatus } from './ticket-status'
import { Button } from './ui/button'

type QueueDetail = components['schemas']['queue.OperatorQueueDetailResponse']
type Action = 'call-next' | 'start' | 'complete' | 'skip' | 'no-show'

type Props = {
  detail: QueueDetail
  busy: boolean
  refreshing: boolean
  pendingAction: Action | null
  message: string
  error: string
  onAction: (action: Action) => void
  onRefresh: () => void
  operatorId?: string
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
  operatorId = '',
}: Props) {
  const { current, waiting } = detail
  const documents = useQuery({
    ...ticketDocumentsOptions(`operator:${operatorId}`, current?.id ?? ''),
    enabled: Boolean(current?.id && current.allowsUploads && operatorId),
  })
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
    'no-show': 'Marking ticket no-show…',
  }

  function handleAction(action: Action, source: HTMLButtonElement) {
    if (busy) return
    restoreActionFocusRef.current = document.activeElement === source ? source : null
    onAction(action)
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
                    className="min-w-0"
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
                          <Button
                            className="min-h-12 px-5"
                            disabled={busy}
                            variant="outline"
                            onClick={(event) => handleAction('no-show', event.currentTarget)}
                          >
                            <UserX aria-hidden="true" />
                            Mark no-show
                          </Button>
                        </>
                      ) : current.status === 'OPERATING' ? (
                        <Button
                          className="min-h-12 px-5"
                          disabled={busy}
                          onClick={(event) => handleAction('complete', event.currentTarget)}
                          ref={focusTargetRef}
                        >
                          <Check aria-hidden="true" />
                          Complete service
                        </Button>
                      ) : null}
                    </div>
                    {Object.entries(current.requestAnswers ?? {}).length > 0 ? (
                      <dl className="mt-6 grid gap-x-5 gap-y-3 border-t pt-4 text-sm sm:grid-cols-2">
                        {Object.entries(current.requestAnswers).map(([id, answer]) => (
                          <div key={id}>
                            <dt className="text-muted-foreground">
                              {current.requestLabels?.[id] ?? 'Request detail'}
                            </dt>
                            <dd className="mt-0.5 font-medium">{answer}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {current.allowsUploads ? (
                      <div className="mt-5 border-t pt-4">
                        <p className="mb-2 text-sm font-semibold">Customer documents</p>
                        {documents.isPending ? (
                          <p className="text-sm text-muted-foreground">Loading documents…</p>
                        ) : documents.isError ? (
                          <p className="text-sm text-status-danger">{documents.error.message}</p>
                        ) : documents.data?.length ? (
                          <ul className="space-y-2">
                            {documents.data.map((document) => (
                              <li key={document.id}>
                                <a
                                  className="text-sm font-medium underline underline-offset-4"
                                  href={`/api/tickets/${encodeURIComponent(current.id)}/documents/${encodeURIComponent(document.id)}`}
                                >
                                  {document.fileName}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No documents attached.</p>
                        )}
                      </div>
                    ) : null}
                    <div className="mt-5 border-t pt-4">
                      <TicketHistoryDisclosure operatorId={operatorId} ticketId={current.id} />
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
            {detail.recent?.length ? (
              <div className="mt-8 border-t pt-5">
                <h3 className="text-base font-semibold">Recent tickets</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Most recently completed, skipped, cancelled, or marked no-show today.
                </p>
                <ol className="mt-3 divide-y border-y">
                  {detail.recent.map((ticket) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                      key={ticket.id}
                    >
                      <span className="flex items-center gap-3">
                        <span className="font-mono font-semibold tabular-nums">
                          {ticket.ticketNumber}
                        </span>
                        <TicketStatus status={ticket.status} />
                      </span>
                      <TicketHistoryDisclosure operatorId={operatorId} ticketId={ticket.id} />
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
        </div>
      </LayoutGroup>
    </MotionConfig>
  )
}

function TicketHistoryDisclosure({
  operatorId,
  ticketId,
}: {
  operatorId: string
  ticketId: string
}) {
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const pageSize = 10
  const history = useQuery({
    queryKey: ['operator', operatorId, 'ticket-history', ticketId, offset],
    queryFn: () => getOperatorTicketHistory({ data: { ticketId, limit: pageSize, offset } }),
    enabled: Boolean(open && operatorId),
  })
  return (
    <div className="min-w-0">
      <Button
        aria-expanded={open}
        className="min-h-9"
        onClick={() => setOpen((value) => !value)}
        variant="outline"
      >
        {open ? 'Hide history' : 'History'}
      </Button>
      {open ? (
        <div className="mt-2">
          {history.isPending ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : history.isError ? (
            <p className="text-sm text-status-danger">{history.error.message}</p>
          ) : history.data ? (
            <>
              <ol className="divide-y border-y">
                {history.data.items.map((event) => (
                  <li className="flex flex-wrap justify-between gap-2 py-2 text-sm" key={event.id}>
                    <span>
                      <strong>{event.toStatus.replaceAll('_', ' ')}</strong>
                      {event.actorName ? ` · ${event.actorName}` : ''}
                    </span>
                    <time className="text-muted-foreground" dateTime={event.occurredAt}>
                      {new Date(event.occurredAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ol>
              {history.data.total > pageSize ? (
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {offset + 1}–{Math.min(offset + history.data.items.length, history.data.total)}{' '}
                    of {history.data.total}
                  </span>
                  <span className="flex gap-2">
                    <Button
                      className="min-h-8"
                      disabled={offset === 0}
                      onClick={() => setOffset((value) => Math.max(0, value - pageSize))}
                      variant="outline"
                    >
                      Previous
                    </Button>
                    <Button
                      className="min-h-8"
                      disabled={offset + pageSize >= history.data.total}
                      onClick={() => setOffset((value) => value + pageSize)}
                      variant="outline"
                    >
                      Next
                    </Button>
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
