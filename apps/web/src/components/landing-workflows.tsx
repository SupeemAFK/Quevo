import { ArrowRight, ListOrdered, PhoneCall, RefreshCw, TicketCheck } from 'lucide-react'
import { MotionConfig, motion } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
import { QueueBackdrop } from './queue-backdrop'
import { TicketStatus } from './ticket-status'

const highlights = [
  {
    icon: TicketCheck,
    audience: 'For customers',
    title: 'Keep your ticket close.',
    description:
      'Choose an active service, join the line, and check your ticket status from your phone.',
    visual: 'ticket',
  },
  {
    icon: ListOrdered,
    audience: 'For operators',
    title: 'Move the line with confidence.',
    description: 'Call the next ticket, then start, complete, or skip service from one queue view.',
    visual: 'order',
  },
  {
    icon: RefreshCw,
    audience: 'Clear at every step',
    title: 'Know what happens next.',
    description:
      'Customers can refresh for the latest status while staff see the same queue order.',
    visual: 'status',
  },
] as const

function reveal(delay: number, reducedMotion: boolean) {
  return {
    initial: reducedMotion ? false : { opacity: 0, y: 10 },
    transition: {
      duration: reducedMotion ? 0 : 0.38,
      delay: reducedMotion ? 0 : delay,
      ease: 'easeOut' as const,
    },
    viewport: { once: true, amount: 0.35 },
    whileInView: { opacity: 1, y: 0 },
  }
}

function HighlightVisual({ visual }: { visual: (typeof highlights)[number]['visual'] }) {
  const prefersReducedMotion = usePrefersReducedMotion()

  if (visual === 'ticket') {
    return (
      <motion.div
        className="border-y py-3"
        transition={{ duration: 0.18, ease: 'easeOut' }}
        whileHover={{ x: 2 }}
      >
        <div aria-hidden="true" className="flex items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">01</span>
          <span className="relative h-px flex-1 bg-border">
            <motion.span
              animate={prefersReducedMotion ? { left: '50%' } : { left: ['0%', '100%'] }}
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-green"
              transition={{
                duration: 2.8,
                ease: 'easeInOut',
                repeat: prefersReducedMotion ? 0 : Infinity,
              }}
            />
          </span>
          <span className="font-mono text-muted-foreground">03</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <TicketCheck aria-hidden="true" size={16} />
            Your ticket
          </span>
          <span className="text-xs text-muted-foreground">Easy to check</span>
        </div>
      </motion.div>
    )
  }

  if (visual === 'order') {
    return (
      <motion.div
        className="flex min-h-[4.6rem] items-center gap-3 border-y py-2.5 text-sm"
        transition={{ duration: 0.18, ease: 'easeOut' }}
        whileHover={{ x: 2 }}
      >
        <ol aria-label="Ordered queue preview" className="flex flex-1 items-center gap-2">
          {['01', '02', '03'].map((position, index) => (
            <li className="flex flex-1 items-center gap-2" key={position}>
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs ${index === 0 ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'}`}
              >
                {position}
              </span>
              {index < 2 ? <span aria-hidden="true" className="h-px flex-1 bg-border" /> : null}
            </li>
          ))}
        </ol>
        <span className="inline-flex shrink-0 items-center gap-2 font-medium text-foreground">
          <PhoneCall aria-hidden="true" size={15} />
          Call next
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="flex min-h-[4.6rem] items-center justify-between gap-3 border-y py-2.5 text-sm"
      transition={{ duration: 0.18, ease: 'easeOut' }}
      whileHover={{ x: 2 }}
    >
      <div>
        <span className="block text-xs text-muted-foreground">Latest check</span>
        <span className="mt-1 inline-flex items-center gap-2 font-medium">
          <RefreshCw
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:rotate-90"
            size={15}
          />
          Refresh when needed
        </span>
      </div>
      <TicketStatus status="WAITING" />
    </motion.div>
  )
}

export function LandingWorkflows() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="workflows-heading"
        className="relative isolate overflow-hidden bg-muted"
        id="workflows"
        tabIndex={-1}
      >
        <QueueBackdrop variant="workflows" />
        <div className="relative z-10 mx-auto max-w-content px-page py-section">
          <motion.div
            className="grid gap-4 border-b border-border pb-8 md:grid-cols-[1fr_0.7fr] md:items-end"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: 'easeOut' }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
          >
            <div>
              <motion.p
                className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground"
                {...reveal(0.02, prefersReducedMotion)}
              >
                Made for real service days
              </motion.p>
              <motion.h2
                aria-label="Know your place. Know what comes next."
                className="mt-3 max-w-2xl text-section font-semibold leading-tight tracking-[-0.045em]"
                id="workflows-heading"
                {...reveal(0.08, prefersReducedMotion)}
              >
                <span aria-hidden="true" className="block">
                  Know your place.
                </span>
                <span aria-hidden="true" className="block">
                  Know what comes next.
                </span>
              </motion.h2>
            </div>
            <motion.p
              className="max-w-md leading-6 text-muted-foreground md:justify-self-end"
              {...reveal(0.18, prefersReducedMotion)}
            >
              Customers keep a ticket on their phone; staff see who is next and what action to take.
            </motion.p>
          </motion.div>

          <div className="grid gap-x-7 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map(({ icon: Icon, audience, title, description, visual }, index) => (
              <motion.article
                className="group flex min-w-0 flex-col border-b border-border py-6 sm:py-8 lg:border-b-0 lg:border-l lg:pl-6 first:lg:border-l-0 first:lg:pl-0"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                key={audience}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.55,
                  delay: prefersReducedMotion ? 0 : index * 0.14,
                  ease: 'easeOut',
                }}
                viewport={{ once: true, amount: 0.2 }}
                whileHover={{ y: -2 }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon
                    aria-hidden="true"
                    className="text-muted-foreground transition-colors group-hover:text-foreground"
                    size={20}
                  />
                  <span className="flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
                    <span>0{index + 1}</span>
                    <span aria-hidden="true">/</span>
                    <span className="font-sans font-medium tracking-wide">{audience}</span>
                  </span>
                </div>
                <motion.h3
                  className="mt-6 text-xl font-semibold tracking-tight"
                  {...reveal(0.08 + index * 0.12, prefersReducedMotion)}
                >
                  {title}
                </motion.h3>
                <motion.p
                  className="mt-2 min-h-12 max-w-sm text-sm leading-6 text-muted-foreground"
                  {...reveal(0.16 + index * 0.12, prefersReducedMotion)}
                >
                  {description}
                </motion.p>
                <div className="mt-6">
                  <HighlightVisual visual={visual} />
                </div>
              </motion.article>
            ))}
          </div>
          <motion.a
            className="group mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline"
            href="#queue-demo"
            initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.3,
              delay: prefersReducedMotion ? 0 : 0.22,
            }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 1 }}
          >
            Explore both views
            <ArrowRight
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
              size={16}
            />
          </motion.a>
        </div>
      </section>
    </MotionConfig>
  )
}
