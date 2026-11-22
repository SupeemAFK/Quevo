import { ArrowRight, ListOrdered, PhoneCall, RefreshCw, TicketCheck } from 'lucide-react'

const highlights = [
  {
    icon: TicketCheck,
    audience: 'For customers',
    title: 'Keep your place with you.',
    description: 'Join an active service and keep your ticket details close on your phone.',
    visual: 'ticket',
  },
  {
    icon: ListOrdered,
    audience: 'For operators',
    title: 'Know who is next.',
    description: 'See the waiting order and focus on the person currently being served.',
    visual: 'order',
  },
  {
    icon: RefreshCw,
    audience: 'At every step',
    title: 'Make the status easy to check.',
    description: 'Customers can refresh their ticket when they want the latest queue status.',
    visual: 'status',
  },
] as const

function HighlightVisual({ visual }: { visual: (typeof highlights)[number]['visual'] }) {
  if (visual === 'ticket') {
    return (
      <div className="flex min-h-12 items-center justify-between gap-3 border-y py-2.5">
        <span className="text-sm font-medium">Your ticket</span>
        <span className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground">Status at a glance</span>
      </div>
    )
  }

  if (visual === 'order') {
    return (
      <div className="flex min-h-12 items-center gap-3 border-y py-2.5 text-sm">
        <span className="font-mono font-semibold tabular-nums">01</span>
        <span className="h-px flex-1 bg-border" />
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <PhoneCall aria-hidden="true" size={15} />
          Call next
        </span>
      </div>
    )
  }

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-y py-2.5 text-sm">
      <span className="text-muted-foreground">Ticket status</span>
      <span className="inline-flex items-center gap-2 font-medium text-muted-foreground">
        <RefreshCw aria-hidden="true" size={15} />
        Refresh when needed
      </span>
    </div>
  )
}

export function LandingWorkflows() {
  return (
    <section
      aria-labelledby="workflows-heading"
      className="mx-auto max-w-content px-page py-section"
      id="workflows"
      tabIndex={-1}
    >
      <div className="grid gap-4 border-b pb-8 md:grid-cols-[1fr_0.7fr] md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Made for real service days
          </p>
          <h2
            className="mt-3 max-w-2xl text-section font-semibold leading-tight tracking-[-0.045em]"
            id="workflows-heading"
          >
            A calmer visit starts with a clear next step.
          </h2>
        </div>
        <p className="max-w-md leading-6 text-muted-foreground md:justify-self-end">
          Quevo gives customers and service teams a shared view of the queue, from the first ticket
          to the final call.
        </p>
      </div>

      <div className="grid gap-x-7 sm:grid-cols-2 lg:grid-cols-3">
        {highlights.map(({ icon: Icon, audience, title, description, visual }, index) => (
          <article
            className="group flex min-w-0 flex-col border-b py-6 sm:py-8 lg:border-b-0 lg:border-l lg:pl-6 first:lg:border-l-0 first:lg:pl-0"
            key={audience}
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
            <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 min-h-12 max-w-sm text-sm leading-6 text-muted-foreground">
              {description}
            </p>
            <div className="mt-6">
              <HighlightVisual visual={visual} />
            </div>
          </article>
        ))}
      </div>
      <a
        className="group mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline"
        href="#queue-demo"
      >
        Explore both views
        <ArrowRight
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
          size={16}
        />
      </a>
    </section>
  )
}
