import { Link } from '@tanstack/react-router'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import type { components } from '@/client/api/schema'
import { FeedbackMessage, LoadingMessage } from './feedback-message'
import { TicketStatus, ticketStatusLabel } from './ticket-status'
import { Button } from './ui/button'

type ServiceOption = components['schemas']['queue.ServiceResponse']
type ActiveTicket = components['schemas']['queue.TicketResponse']

type CustomerServiceSelectionProps = {
  services: ServiceOption[]
  activeTickets: ActiveTicket[]
  joining: boolean
  error: string
  onJoin: (service: ServiceOption) => void
}

export function CustomerServiceSelection({
  services,
  activeTickets,
  joining,
  error,
  onJoin,
}: CustomerServiceSelectionProps) {
  const [selectedServiceID, setSelectedServiceID] = useState('')
  const [selectionError, setSelectionError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (joining) return
    const selectedService = services.find((service) => service.id === selectedServiceID)
    if (!selectedService) {
      setSelectionError('Select a service before joining the queue.')
      return
    }
    setSelectionError('')
    onJoin(selectedService)
  }

  return (
    <div className="space-y-8">
      {activeTickets.length > 0 ? (
        <section aria-labelledby="active-tickets-heading" className="p-0">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight" id="active-tickets-heading">
              Your active tickets
            </h2>
            <p className="text-sm text-muted-foreground">Return to a ticket to view its status.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {activeTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  aria-label={`View ticket ${ticket.ticketNumber} (${ticket.serviceName} at ${ticket.branchName}). Status: ${ticketStatusLabel(ticket.status)}`}
                  className="group flex min-h-28 flex-col rounded-lg border bg-card p-4 text-left transition-colors duration-200 hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  params={{ ticketId: ticket.id }}
                  to="/tickets/$ticketId"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Ticket</span>
                    <TicketStatus status={ticket.status} />
                  </span>
                  <span className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                    <span className="font-mono">{ticket.ticketNumber}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="min-w-0 truncate">
                      {ticket.serviceName} · {ticket.branchName}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="shrink-0 text-brand-accent transition-transform group-hover:translate-x-0.5"
                      size={18}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="space-y-5" onSubmit={submit}>
        {services.length === 0 ? (
          <section
            aria-labelledby="services-empty-heading"
            className="rounded-lg border bg-card p-5"
          >
            <h2 className="font-medium" id="services-empty-heading">
              No active services
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No active services are available right now. Check again later.
            </p>
          </section>
        ) : (
          <fieldset className="space-y-3" disabled={joining}>
            <legend className="mb-3 text-base font-semibold">Choose an active service</legend>
            {services.map((service) => {
              const selected = selectedServiceID === service.id
              return (
                <button
                  aria-pressed={selected}
                  aria-label={`${service.name} at ${service.branchName}`}
                  className={`flex min-h-20 w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? 'border-brand-accent bg-card' : 'bg-card hover:border-foreground/40'}`}
                  key={service.id}
                  onClick={() => {
                    setSelectedServiceID(service.id)
                    setSelectionError('')
                  }}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{service.name}</span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {service.branchName}
                    </span>
                  </span>
                  <span
                    className={`inline-flex min-h-7 shrink-0 items-center gap-1 text-sm font-medium ${selected ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {selected ? 'Selected' : 'Choose'}
                    {selected ? <ArrowRight aria-hidden="true" size={15} /> : null}
                  </span>
                </button>
              )
            })}
          </fieldset>
        )}

        {joining ? <LoadingMessage>Joining queue…</LoadingMessage> : null}
        {selectionError ? <FeedbackMessage kind="error">{selectionError}</FeedbackMessage> : null}
        {error ? <FeedbackMessage kind="error">{error}</FeedbackMessage> : null}
        <Button
          aria-disabled={joining || services.length === 0}
          className="min-h-12 w-full px-5 aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:w-auto"
          disabled={services.length === 0}
          type="submit"
        >
          Join queue
          {!joining ? <ArrowRight aria-hidden="true" /> : null}
        </Button>
      </form>
    </div>
  )
}
