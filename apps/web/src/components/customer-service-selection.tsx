import { Link } from '@tanstack/react-router'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
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
  const joinStartedRef = useRef(false)
  const singleService = services.length === 1 ? services[0] : undefined
  const selectedService =
    services.find((service) => service.id === selectedServiceID) ?? singleService
  const activeServiceIDs = new Set(activeTickets.map((ticket) => ticket.serviceId))
  const selectedServiceHasActiveTicket = selectedService
    ? activeServiceIDs.has(selectedService.id)
    : false

  useEffect(() => {
    if (!joining) joinStartedRef.current = false
  }, [joining])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (joining || joinStartedRef.current) return
    if (!selectedService) {
      setSelectionError('Select a service before joining the queue.')
      return
    }
    if (activeServiceIDs.has(selectedService.id)) {
      setSelectionError(
        'You already have an active ticket for this service. Open it above to check your status.',
      )
      return
    }
    setSelectionError('')
    joinStartedRef.current = true
    onJoin(selectedService)
  }

  return (
    <div className="space-y-9">
      {activeTickets.length > 0 ? (
        <section aria-labelledby="active-tickets-heading" className="border-b pb-7">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight" id="active-tickets-heading">
              Your active tickets
            </h2>
            <p className="text-sm text-muted-foreground">Return to a ticket to view its status.</p>
          </div>
          <ul className="divide-y border-y">
            {activeTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  aria-label={`View ticket ${ticket.ticketNumber} (${ticket.serviceName} at ${ticket.branchName}). Status: ${ticketStatusLabel(ticket.status)}`}
                  className="group flex min-h-16 flex-wrap items-center justify-between gap-x-5 gap-y-2 py-3 focus-visible:outline"
                  params={{ ticketId: ticket.id }}
                  to="/tickets/$ticketId"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-lg font-semibold tabular-nums">
                      {ticket.ticketNumber}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {ticket.serviceName}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {ticket.branchName}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <TicketStatus status={ticket.status} />
                    <ChevronRight
                      aria-hidden="true"
                      className="shrink-0 text-brand-green transition-transform group-hover:translate-x-0.5"
                      size={18}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="space-y-6" onSubmit={submit}>
        {services.length === 0 ? (
          <section aria-labelledby="services-empty-heading" className="border-y py-5">
            <h2 className="font-semibold" id="services-empty-heading">
              No active services
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No active services are available right now. Check again later.
            </p>
          </section>
        ) : singleService ? (
          <fieldset
            aria-describedby={selectedServiceHasActiveTicket ? 'active-service-note' : undefined}
            className="border-y py-5"
          >
            <legend className="mb-3 text-sm font-medium text-muted-foreground">
              Active service
            </legend>
            <p className="text-xl font-semibold tracking-tight">{singleService.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{singleService.branchName}</p>
            {selectedServiceHasActiveTicket ? (
              <p className="mt-3 text-sm text-muted-foreground" id="active-service-note">
                You already have an active ticket for this service. Open it above to check your
                status.
              </p>
            ) : null}
          </fieldset>
        ) : (
          <fieldset className="space-y-2" disabled={joining}>
            <legend className="mb-3 text-base font-semibold">Choose a service</legend>
            <div className="divide-y border-y">
              {services.map((service) => {
                const selected = selectedService?.id === service.id
                const hasActiveTicket = activeServiceIDs.has(service.id)
                return (
                  <label
                    className={`flex min-h-20 cursor-pointer items-center gap-4 py-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${hasActiveTicket ? 'cursor-not-allowed opacity-70' : ''}`}
                    htmlFor={`service-${service.id}`}
                    key={service.id}
                  >
                    <input
                      checked={selected}
                      className="size-5 shrink-0 accent-brand-green"
                      disabled={hasActiveTicket}
                      id={`service-${service.id}`}
                      name="service"
                      onChange={() => {
                        setSelectedServiceID(service.id)
                        setSelectionError('')
                      }}
                      type="radio"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{service.name}</span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {service.branchName}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm">
                      {hasActiveTicket ? (
                        <span className="text-muted-foreground">Already joined</span>
                      ) : selected ? (
                        <span className="inline-flex items-center gap-1 font-medium text-brand-green">
                          <span>Selected</span>
                          <ArrowRight aria-hidden="true" size={15} />
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        {joining ? <LoadingMessage>Joining queue…</LoadingMessage> : null}
        {selectionError ? <FeedbackMessage kind="error">{selectionError}</FeedbackMessage> : null}
        {error ? <FeedbackMessage kind="error">{error}</FeedbackMessage> : null}
        {services.length > 1 && !selectedService ? (
          <p className="text-sm text-muted-foreground">Choose an available service to continue.</p>
        ) : null}
        <Button
          className="min-h-12 w-full px-5 sm:w-auto"
          disabled={
            joining || services.length === 0 || !selectedService || selectedServiceHasActiveTicket
          }
          type="submit"
        >
          {joining ? 'Joining queue…' : 'Join queue'}
          {!joining ? <ArrowRight aria-hidden="true" /> : null}
        </Button>
      </form>
    </div>
  )
}
