import {
  Activity,
  ArrowRight,
  Check,
  Pause,
  PhoneCall,
  Play,
  RotateCcw,
  TicketCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
import { TicketStatus } from './ticket-status'
import { Button } from './ui/button'

type DemoTicket = {
  id: string
  number: string
}

type PreviewView = 'operator' | 'customer'
type QueueDemoProps = { autoPlay?: boolean }

const initialTickets: DemoTicket[] = [
  { id: 'demo-ticket-1', number: 'A101' },
  { id: 'demo-ticket-2', number: 'A102' },
  { id: 'demo-ticket-3', number: 'A103' },
]

const customerTicketNumber = 'A102'

function copyInitialTickets() {
  return initialTickets.map((ticket) => ({ ...ticket }))
}

function QueueStep({
  index,
  ticket,
  detail,
  status,
  highlighted = false,
}: {
  index: number
  ticket: DemoTicket
  detail: string
  status: string
  highlighted?: boolean
}) {
  return (
    <motion.li
      animate={{ opacity: 1, y: 0 }}
      className="relative flex min-h-[4.25rem] items-center gap-3"
      initial={{ opacity: 0, y: 5 }}
      key={ticket.id}
      layout
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <span
        aria-hidden="true"
        className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border bg-card font-mono text-xs tabular-nums ${highlighted ? 'border-brand-green text-brand-green' : 'border-border text-muted-foreground'}`}
      >
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 border-b border-border py-3">
        <div className="min-w-0">
          <p className="font-mono text-base font-semibold tabular-nums tracking-tight">
            {ticket.number}
          </p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <TicketStatus status={status} />
      </div>
    </motion.li>
  )
}

export function QueueDemo({ autoPlay = true }: QueueDemoProps = {}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [waiting, setWaiting] = useState(copyInitialTickets)
  const [current, setCurrent] = useState<DemoTicket | null>(null)
  const [served, setServed] = useState<DemoTicket[]>([])
  const [view, setView] = useState<PreviewView>('operator')
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [announcement, setAnnouncement] = useState('Demo ready. Three sample tickets are waiting.')

  const next = waiting[0] ?? null
  const ticketWasServed = served.some((ticket) => ticket.number === customerTicketNumber)
  const customerIsCurrent = current?.number === customerTicketNumber
  const customerPosition = waiting.findIndex((ticket) => ticket.number === customerTicketNumber)
  const customerStatus = ticketWasServed
    ? 'COMPLETED'
    : customerIsCurrent
      ? 'OPERATING'
      : !current && customerPosition === 0
        ? 'NEXT_UP'
        : 'WAITING'
  const customerGuidance = ticketWasServed
    ? 'Your turn is complete.'
    : customerIsCurrent
      ? 'Your ticket is with the service team.'
      : customerStatus === 'NEXT_UP'
        ? 'You’re next. The service team can call you when ready.'
        : current
          ? 'One ticket is being served before yours.'
          : 'You’re in the queue. Keep this ticket handy and refresh for status updates.'

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsPlaying(false)
      return
    }
    if (!isPlaying) return

    const timeout = window.setTimeout(() => {
      if (current) {
        if (waiting.length === 0) {
          setWaiting(copyInitialTickets())
          setServed([])
          setAnnouncement(`Ticket ${current.number} is served. The sample queue is starting again.`)
        } else {
          setServed((tickets) => [...tickets, current])
          setAnnouncement(`Ticket ${current.number} is marked served.`)
        }
        setCurrent(null)
      } else if (next) {
        setWaiting((tickets) => tickets.slice(1))
        setCurrent(next)
        setAnnouncement(`Ticket ${next.number} is now called.`)
      } else {
        setWaiting(copyInitialTickets())
        setServed([])
        setAnnouncement('The sample queue is starting again.')
      }
    }, 1350)

    return () => window.clearTimeout(timeout)
  }, [current, isPlaying, next, prefersReducedMotion, waiting.length])

  function callNext() {
    if (!next || current) return
    setWaiting((tickets) => tickets.slice(1))
    setCurrent(next)
    setAnnouncement(`Ticket ${next.number} is now called.`)
  }

  function markServed() {
    if (!current) return
    setServed((tickets) => [...tickets, current])
    setAnnouncement(`Ticket ${current.number} is marked served.`)
    setCurrent(null)
  }

  function resetDemo() {
    setIsPlaying(false)
    setWaiting(copyInitialTickets())
    setCurrent(null)
    setServed([])
    setAnnouncement('Demo reset. Three sample tickets are waiting.')
  }

  function toggleSamplePlayback() {
    if (isPlaying) {
      setIsPlaying(false)
      setAnnouncement('Sample paused.')
      return
    }

    if (!next && !current) {
      setWaiting(copyInitialTickets())
      setServed([])
      setAnnouncement('Sample restarted. Tickets are moving through the queue.')
    } else {
      setAnnouncement('Sample playing. Tickets are moving through the queue.')
    }
    setIsPlaying(true)
  }

  const customerOrder = [
    ...served.map((ticket) => ({ ticket, status: 'COMPLETED', detail: 'Completed' })),
    ...(current
      ? [{ ticket: current, status: 'PENDING', detail: 'Now with the service team' }]
      : []),
    ...waiting.map((ticket, index) => ({
      ticket,
      status:
        !current && index === 0
          ? 'NEXT_UP'
          : ticket.number === customerTicketNumber
            ? customerStatus
            : 'WAITING',
      detail:
        ticket.number === customerTicketNumber
          ? 'Your ticket'
          : !current && index === 0
            ? 'Next to be called'
            : 'In the queue',
    })),
  ]
  const operatorOrder = [
    ...(current ? [{ ticket: current, status: 'PENDING', detail: 'Current ticket' }] : []),
    ...waiting.map((ticket, index) => ({
      ticket,
      status: !current && index === 0 ? 'NEXT_UP' : 'WAITING',
      detail: !current && index === 0 ? 'Next to be called' : 'Waiting in order',
    })),
  ]

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-label="Queue preview"
        className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-[0_18px_48px_-32px_rgb(0_0_0_/_0.45)]"
        id="queue-demo"
        tabIndex={-1}
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-4 sm:px-6">
          <div>
            <p className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Activity aria-hidden="true" className="text-brand-green" size={15} />
              Interactive sample
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight" id="queue-demo-heading">
              One queue, two views
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <fieldset className="flex items-center rounded-lg border bg-muted p-1">
              <legend className="sr-only">Preview as</legend>
              <motion.button
                aria-pressed={view === 'customer'}
                className={`relative isolate inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${view === 'customer' ? 'text-background' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setView('customer')}
                type="button"
                whileTap={{ scale: 0.97 }}
              >
                {view === 'customer' ? (
                  <motion.span
                    className="absolute inset-0 -z-10 rounded-md bg-foreground"
                    layoutId="queue-role-selection"
                    transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                  />
                ) : null}
                <UserRound aria-hidden="true" className="shrink-0" size={16} />
                Customer
              </motion.button>
              <motion.button
                aria-pressed={view === 'operator'}
                className={`relative isolate inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${view === 'operator' ? 'text-background' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setView('operator')}
                type="button"
                whileTap={{ scale: 0.97 }}
              >
                {view === 'operator' ? (
                  <motion.span
                    className="absolute inset-0 -z-10 rounded-md bg-foreground"
                    layoutId="queue-role-selection"
                    transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                  />
                ) : null}
                <UsersRound aria-hidden="true" className="shrink-0" size={16} />
                Operator
              </motion.button>
            </fieldset>
            <Button
              aria-label={isPlaying ? 'Pause sample queue' : 'Play sample queue'}
              className="min-h-10 gap-1.5 px-3"
              disabled={prefersReducedMotion}
              onClick={toggleSamplePlayback}
              size="sm"
              title={prefersReducedMotion ? 'Sample playback is off for reduced motion' : undefined}
              variant="outline"
            >
              {isPlaying ? (
                <Pause aria-hidden="true" size={15} />
              ) : (
                <Play aria-hidden="true" size={15} />
              )}
              <span>{isPlaying ? 'Pause' : 'Play sample'}</span>
            </Button>
          </div>
        </header>

        <AnimatePresence initial={false} mode="wait">
          {view === 'operator' ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid min-w-0 md:grid-cols-[0.9fr_1.1fr]"
              exit={{ opacity: 0, y: 4 }}
              initial={{ opacity: 0, y: 4 }}
              key="operator"
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <section
                aria-labelledby="demo-current-heading"
                className="flex min-h-[22rem] flex-col justify-between bg-muted p-5 text-foreground sm:p-6 dark:bg-accent dark:text-foreground"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3
                      className="text-sm font-medium text-muted-foreground"
                      id="demo-current-heading"
                    >
                      Current ticket
                    </h3>
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {current ? 'In service' : next ? 'Next to call' : 'Queue clear'}
                    </span>
                  </div>
                  <AnimatePresence initial={false} mode="wait">
                    {current || next ? (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8"
                        exit={{ opacity: 0, y: -4 }}
                        initial={{ opacity: 0, y: 4 }}
                        key={current?.id ?? next?.id}
                        transition={{ duration: 0.16 }}
                      >
                        <p className="font-mono text-6xl font-semibold tabular-nums tracking-[-0.07em] sm:text-7xl">
                          <AnimatePresence initial={false} mode="popLayout">
                            <motion.span
                              animate={{ opacity: 1, y: 0 }}
                              initial={{ opacity: 0, y: 8 }}
                              key={(current ?? next)?.number}
                              transition={{ duration: 0.18, ease: 'easeOut' }}
                            >
                              {(current ?? next)?.number}
                            </motion.span>
                          </AnimatePresence>
                        </p>
                        <div className="mt-4">
                          <TicketStatus status={current ? 'PENDING' : 'NEXT_UP'} />
                        </div>
                      </motion.div>
                    ) : (
                      <p className="mt-8 text-2xl font-medium tracking-tight">All caught up.</p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-8 grid gap-2">
                  <Button
                    className="min-h-11 w-full min-w-0 justify-between px-4"
                    disabled={isPlaying || current !== null || waiting.length === 0}
                    onClick={callNext}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <PhoneCall aria-hidden="true" className="shrink-0" size={17} />
                      Call next
                    </span>
                    <ArrowRight aria-hidden="true" className="shrink-0" size={16} />
                  </Button>
                  <Button
                    className="min-h-11 w-full min-w-0 border-border bg-transparent px-4 text-foreground hover:bg-background"
                    disabled={isPlaying || current === null}
                    onClick={markServed}
                    variant="outline"
                  >
                    <Check aria-hidden="true" size={16} />
                    Mark served
                  </Button>
                  <Button
                    className="min-h-10 w-full min-w-0 text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={resetDemo}
                    variant="ghost"
                  >
                    <RotateCcw aria-hidden="true" size={15} />
                    Reset demo
                  </Button>
                </div>
              </section>

              <section aria-labelledby="demo-waiting-heading" className="min-w-0 p-5 sm:p-6">
                <div className="flex items-end justify-between gap-3 border-b pb-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      General service
                    </p>
                    <h3
                      className="mt-1 text-lg font-semibold tracking-tight"
                      id="demo-waiting-heading"
                    >
                      Queue order
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm tabular-nums text-muted-foreground">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        initial={{ opacity: 0, y: 4 }}
                        key={operatorOrder.length}
                        transition={{ duration: 0.14, ease: 'easeOut' }}
                      >
                        {operatorOrder.length.toString().padStart(2, '0')}
                      </motion.span>
                    </AnimatePresence>
                    <span className="font-sans">in line</span>
                  </span>
                </div>

                {operatorOrder.length > 0 ? (
                  <ol
                    aria-label="Sample tickets waiting"
                    className="relative mt-2 before:absolute before:bottom-6 before:left-[15px] before:top-6 before:w-px before:bg-border"
                  >
                    <AnimatePresence initial={false}>
                      {operatorOrder.map(({ ticket, status, detail }, index) => (
                        <QueueStep
                          detail={detail}
                          highlighted={status === 'NEXT_UP' || status === 'PENDING'}
                          index={index}
                          key={ticket.id}
                          status={status}
                          ticket={ticket}
                        />
                      ))}
                    </AnimatePresence>
                  </ol>
                ) : (
                  <p className="py-8 text-sm text-muted-foreground">
                    No sample tickets are waiting.
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                  <TicketCheck aria-hidden="true" size={15} />
                  {served.length > 0
                    ? `${served.at(-1)?.number} completed in this sample`
                    : 'Tickets stay in order as the queue moves'}
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid min-w-0 md:grid-cols-[0.9fr_1.1fr]"
              exit={{ opacity: 0, y: 4 }}
              initial={{ opacity: 0, y: 4 }}
              key="customer"
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <section
                aria-labelledby="demo-customer-heading"
                className="flex min-h-[22rem] flex-col justify-between bg-muted p-5 text-foreground sm:p-6 dark:bg-accent dark:text-foreground"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3
                      className="text-sm font-medium text-muted-foreground"
                      id="demo-customer-heading"
                    >
                      Your ticket
                    </h3>
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      General service
                    </span>
                  </div>
                  <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 font-mono text-6xl font-semibold tabular-nums tracking-[-0.07em] sm:text-7xl"
                    key={customerStatus}
                    initial={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.16 }}
                  >
                    {customerTicketNumber}
                  </motion.p>
                  <div className="mt-4">
                    <TicketStatus status={customerStatus} />
                  </div>
                </div>
                <div className="mt-8 border-t border-border pt-4">
                  <p className="text-sm leading-6 text-muted-foreground">{customerGuidance}</p>
                  <button
                    className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline"
                    onClick={() => setView('operator')}
                    type="button"
                  >
                    See the operator view
                    <ArrowRight aria-hidden="true" size={16} />
                  </button>
                </div>
              </section>

              <section aria-labelledby="demo-progress-heading" className="min-w-0 p-5 sm:p-6">
                <div className="flex items-end justify-between gap-3 border-b pb-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Your place in line
                    </p>
                    <h3
                      className="mt-1 text-lg font-semibold tracking-tight"
                      id="demo-progress-heading"
                    >
                      Queue progress
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm tabular-nums text-muted-foreground">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        initial={{ opacity: 0, y: 4 }}
                        key={customerOrder.length}
                        transition={{ duration: 0.14, ease: 'easeOut' }}
                      >
                        {customerOrder.length.toString().padStart(2, '0')}
                      </motion.span>
                    </AnimatePresence>
                    <span className="font-sans">tickets</span>
                  </span>
                </div>
                {customerOrder.length > 0 ? (
                  <ol
                    aria-label="Sample queue progression"
                    className="relative mt-2 before:absolute before:bottom-6 before:left-[15px] before:top-6 before:w-px before:bg-border"
                  >
                    <AnimatePresence initial={false}>
                      {customerOrder.map(({ ticket, status, detail }, index) => (
                        <QueueStep
                          detail={detail}
                          highlighted={
                            ticket.number === customerTicketNumber || status === 'NEXT_UP'
                          }
                          index={index}
                          key={ticket.id}
                          status={status}
                          ticket={ticket}
                        />
                      ))}
                    </AnimatePresence>
                  </ol>
                ) : null}
                <div className="mt-4 flex items-start gap-2 border-t pt-4 text-xs leading-5 text-muted-foreground">
                  <TicketCheck aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
                  This is a sample queue. Changes stay on this page.
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        <p aria-atomic="true" className="sr-only" role="status">
          {announcement}
        </p>
        {served.length > 0 ? (
          <section aria-labelledby="demo-served-heading" className="border-t px-5 py-3 sm:px-6">
            <h3 className="sr-only" id="demo-served-heading">
              Served in this demo
            </h3>
            <ul
              aria-label="Served in this demo"
              className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
            >
              {served.map((ticket) => (
                <li className="inline-flex items-center gap-2" key={ticket.id}>
                  <Check aria-hidden="true" className="text-status-success" size={14} />
                  <span className="font-mono font-medium tabular-nums">{ticket.number}</span>
                  <span>Served</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </MotionConfig>
  )
}
