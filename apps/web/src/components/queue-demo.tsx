import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useState } from 'react'
import { Button } from './ui/button'

type DemoTicket = {
  id: string
  number: string
}

const initialTickets: DemoTicket[] = [
  { id: 'demo-ticket-1', number: 'A101' },
  { id: 'demo-ticket-2', number: 'A102' },
  { id: 'demo-ticket-3', number: 'A103' },
]

function copyInitialTickets() {
  return initialTickets.map((ticket) => ({ ...ticket }))
}

export function QueueDemo() {
  const [waiting, setWaiting] = useState(copyInitialTickets)
  const [current, setCurrent] = useState<DemoTicket | null>(null)
  const [served, setServed] = useState<DemoTicket[]>([])
  const [announcement, setAnnouncement] = useState('Demo ready. Three sample tickets are waiting.')

  function callNext() {
    const next = waiting[0]
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
    setWaiting(copyInitialTickets())
    setCurrent(null)
    setServed([])
    setAnnouncement('Demo reset. Three sample tickets are waiting.')
  }

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="queue-demo-heading"
        className="scroll-mt-24 border-y bg-muted/50"
        id="queue-demo"
      >
        <div className="mx-auto grid max-w-content gap-8 px-page py-section lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              A safe, sample queue
            </p>
            <h2 className="mt-3 text-section font-semibold tracking-tight" id="queue-demo-heading">
              Try the flow before you sign in.
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              This interactive example uses sample tickets stored in this page only. It never reads
              or changes a branch queue.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Queue walkthrough</p>
                <p className="mt-1 text-lg font-semibold">General service</p>
              </div>
              <span className="rounded-full bg-status-info-surface px-3 py-1 text-sm font-medium text-status-info">
                Sample data
              </span>
            </div>

            <div className="grid gap-5 py-5 sm:grid-cols-2">
              <section aria-labelledby="demo-current-heading" className="min-w-0">
                <h3 className="text-sm font-medium text-muted-foreground" id="demo-current-heading">
                  Current ticket
                </h3>
                {current ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <p className="text-3xl font-semibold tabular-nums tracking-tight">
                      {current.number}
                    </p>
                    <p className="mt-2 inline-flex rounded-full bg-status-info-surface px-2.5 py-1 text-sm font-medium text-status-info">
                      Called
                    </p>
                  </motion.div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No ticket is being called.
                  </p>
                )}
              </section>

              <section aria-labelledby="demo-waiting-heading" className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className="text-sm font-medium text-muted-foreground"
                    id="demo-waiting-heading"
                  >
                    Waiting
                  </h3>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {waiting.length} {waiting.length === 1 ? 'ticket' : 'tickets'}
                  </span>
                </div>
                <ol aria-label="Sample tickets waiting" className="mt-2 divide-y">
                  <AnimatePresence initial={false}>
                    {waiting.map((ticket) => (
                      <motion.li
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between gap-3 py-3"
                        exit={{ opacity: 0, y: -6 }}
                        initial={{ opacity: 0, y: 6 }}
                        key={ticket.id}
                        layout
                        transition={{ duration: 0.18 }}
                      >
                        <span className="font-medium tabular-nums">{ticket.number}</span>
                        <span className="text-sm text-muted-foreground">Waiting</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ol>
                {waiting.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">
                    No sample tickets are waiting.
                  </p>
                ) : null}
              </section>
            </div>

            <div className="flex flex-wrap gap-3 border-t pt-5">
              <Button
                className="min-h-11 px-4"
                disabled={waiting.length === 0 || current !== null}
                onClick={callNext}
              >
                Call next
              </Button>
              <Button
                className="min-h-11 px-4"
                disabled={current === null}
                onClick={markServed}
                variant="outline"
              >
                Mark served
              </Button>
              <Button className="min-h-11 px-4" onClick={resetDemo} variant="ghost">
                Reset demo
              </Button>
            </div>

            <p aria-atomic="true" className="sr-only" role="status">
              {announcement}
            </p>

            {served.length > 0 ? (
              <section aria-labelledby="demo-served-heading" className="mt-5 border-t pt-4">
                <h3 className="text-sm font-medium text-muted-foreground" id="demo-served-heading">
                  Served in this demo
                </h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {served.map((ticket) => (
                    <li
                      className="rounded-full bg-status-success-surface px-3 py-1 text-sm font-medium text-status-success"
                      key={ticket.id}
                    >
                      {ticket.number} · Served
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}
