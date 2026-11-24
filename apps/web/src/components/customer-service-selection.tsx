import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileUp,
  Layers3,
  LoaderCircle,
  MapPin,
  Store,
  Ticket,
  TicketCheck,
} from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { components } from '@/client/api/schema'
import { FeedbackMessage, LoadingMessage } from './feedback-message'
import { TicketStatus, ticketStatusLabel } from './ticket-status'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

type ServiceOption = components['schemas']['queue.ServiceResponse']
type ActiveTicket = components['schemas']['queue.TicketResponse']

type CustomerServiceSelectionProps = {
  services: ServiceOption[]
  activeTickets: ActiveTicket[]
  joining: boolean
  error: string
  onJoin: (service: ServiceOption, queueID: string, requestAnswers: Record<string, string>) => void
}

export function CustomerServiceSelection({
  services,
  activeTickets,
  joining,
  error,
  onJoin,
}: CustomerServiceSelectionProps) {
  const [selectedServiceID, setSelectedServiceID] = useState('')
  const [selectedQueueID, setSelectedQueueID] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selectionError, setSelectionError] = useState('')
  const joinStartedRef = useRef(false)
  const selectedService =
    services.find((service) => service.id === selectedServiceID) ??
    (services.length === 1 ? services[0] : undefined)
  const selectedQueue =
    selectedService?.queues.find((queue) => queue.id === selectedQueueID) ??
    (selectedService?.queues.length === 1 ? selectedService.queues[0] : undefined)
  const missingRequiredField = Boolean(
    selectedService?.fields.some((field) => field.required && !answers[field.id]?.trim()),
  )

  useEffect(() => {
    if (!joining) joinStartedRef.current = false
  }, [joining])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (joining || joinStartedRef.current) return
    if (!selectedService || !selectedQueue) {
      setSelectionError('Select a service and queue before joining.')
      return
    }
    if (missingRequiredField) {
      setSelectionError('Complete the required service details before joining.')
      return
    }
    setSelectionError('')
    joinStartedRef.current = true
    onJoin(selectedService, selectedQueue.id, answers)
  }

  function selectService(service: ServiceOption) {
    setSelectedServiceID(service.id)
    setSelectedQueueID(service.queues.length === 1 ? service.queues[0].id : '')
    setAnswers({})
    setSelectionError('')
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-9">
        {activeTickets.length > 0 ? (
          <section aria-labelledby="active-tickets-heading" className="border-b pb-7">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
                id="active-tickets-heading"
              >
                <TicketCheck aria-hidden="true" size={19} />
                Your active tickets
              </h2>
              <p className="text-sm text-muted-foreground">
                Return to a ticket to view its status.
              </p>
            </div>
            <ul className="divide-y border-y">
              <AnimatePresence initial={false}>
                {activeTickets.map((ticket) => (
                  <motion.li
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    initial={{ opacity: 0, y: 4 }}
                    key={ticket.id}
                    layout
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <Link
                      aria-label={`View ticket ${ticket.ticketNumber} (${ticket.serviceName} at ${ticket.branchName}). Status: ${ticketStatusLabel(ticket.status)}`}
                      className="group flex min-h-16 flex-wrap items-center justify-between gap-x-5 gap-y-2 py-3 focus-visible:outline"
                      params={{ ticketId: ticket.id }}
                      to="/tickets/$ticketId"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Ticket
                          aria-hidden="true"
                          className="shrink-0 text-muted-foreground"
                          size={18}
                        />
                        <span className="font-mono text-lg font-semibold tabular-nums">
                          {ticket.ticketNumber}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {ticket.serviceName}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                            <MapPin aria-hidden="true" size={13} />
                            {ticket.branchName}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <TicketStatus status={ticket.status} />
                        <ChevronRight
                          aria-hidden="true"
                          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                          size={18}
                        />
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ) : null}

        <form className="space-y-6" onSubmit={submit}>
          {services.length === 0 ? (
            <section aria-labelledby="services-empty-heading" className="border-y py-5">
              <h2
                className="inline-flex items-center gap-2 font-semibold"
                id="services-empty-heading"
              >
                <Store aria-hidden="true" size={18} />
                No active services
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No active services are available right now. Check again later.
              </p>
            </section>
          ) : services.length === 1 ? (
            <fieldset className="border-y py-5">
              <legend className="mb-3 text-sm font-medium text-muted-foreground">
                Active service
              </legend>
              <p className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <Layers3 aria-hidden="true" size={19} />
                {services[0].name}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin aria-hidden="true" size={14} />
                {services[0].branchName}
              </p>
            </fieldset>
          ) : (
            <fieldset className="space-y-2" disabled={joining}>
              <legend className="mb-3 text-base font-semibold">Choose a service</legend>
              <div className="grid gap-2">
                {services.map((service) => {
                  const selected = selectedService?.id === service.id
                  return (
                    <motion.label
                      className={`group/service flex min-h-20 cursor-pointer items-center gap-4 rounded-lg border bg-card px-4 py-4 transition-[border-color,box-shadow,transform] hover:border-foreground/40 hover:shadow-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${selected ? 'border-brand-green shadow-[inset_3px_0_0_var(--brand-green)]' : 'border-border'}`}
                      htmlFor={`service-${service.id}`}
                      key={service.id}
                      layout
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.995 }}
                    >
                      <input
                        checked={selected}
                        className="size-5 shrink-0 accent-brand-green"
                        id={`service-${service.id}`}
                        name="service"
                        onChange={() => selectService(service)}
                        type="radio"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 truncate font-semibold">
                          <Layers3
                            aria-hidden="true"
                            className="shrink-0 text-muted-foreground"
                            size={17}
                          />
                          {service.name}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                          <MapPin aria-hidden="true" size={13} />
                          {service.branchName}
                        </span>
                      </span>
                      {selected ? (
                        <Check aria-hidden="true" className="shrink-0 text-brand-green" size={17} />
                      ) : null}
                    </motion.label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {selectedService ? (
            <div className="space-y-5">
              {selectedService.queues.length > 1 ? (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="queue-choice"
                    id="queue-choice-label"
                  >
                    Choose a queue
                  </label>
                  <Select
                    onValueChange={(queueID) => {
                      setSelectedQueueID(queueID)
                      setSelectionError('')
                    }}
                    value={selectedQueueID}
                  >
                    <SelectTrigger
                      aria-labelledby="queue-choice-label"
                      className="min-h-11 w-full"
                      id="queue-choice"
                    >
                      <SelectValue placeholder="Select a queue" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedService.queues.map((queue) => (
                        <SelectItem key={queue.id} value={queue.id}>
                          {queue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : selectedQueue ? (
                <p className="text-sm text-muted-foreground">
                  Queue: <span className="font-medium text-foreground">{selectedQueue.name}</span>
                </p>
              ) : null}

              {selectedService.fields.length > 0 ? (
                <fieldset className="space-y-4 border-t pt-5">
                  <legend className="pb-1 text-base font-semibold">
                    A few details for the team
                  </legend>
                  {selectedService.fields.map((field) => (
                    <div className="space-y-2" key={field.id}>
                      <label
                        className="text-sm font-medium"
                        htmlFor={`field-${field.id}`}
                        id={`field-${field.id}-label`}
                      >
                        {field.label}
                        {field.required ? <span aria-hidden="true"> *</span> : null}
                        {field.required ? <span className="sr-only"> required</span> : null}
                      </label>
                      {field.type === 'single_select' ? (
                        <Select
                          onValueChange={(value) => {
                            setAnswers((current) => ({ ...current, [field.id]: value }))
                            setSelectionError('')
                          }}
                          value={answers[field.id] ?? ''}
                        >
                          <SelectTrigger
                            aria-invalid={field.required && !answers[field.id]}
                            aria-required={field.required}
                            aria-labelledby={`field-${field.id}-label`}
                            className="min-h-11 w-full"
                            id={`field-${field.id}`}
                          >
                            <SelectValue placeholder="Choose one" />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input
                          autoComplete="off"
                          className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                          id={`field-${field.id}`}
                          maxLength={200}
                          onChange={(event) => {
                            setAnswers((current) => ({
                              ...current,
                              [field.id]: event.target.value,
                            }))
                            setSelectionError('')
                          }}
                          required={field.required}
                          type="text"
                          value={answers[field.id] ?? ''}
                        />
                      )}
                    </div>
                  ))}
                  <p className="text-xs leading-5 text-muted-foreground">
                    Please don’t enter account or card numbers, ID numbers, passwords, PINs, OTPs,
                    or income details.
                  </p>
                </fieldset>
              ) : null}

              {selectedService.allowsUploads ? (
                <section aria-labelledby="document-step-heading" className="border-t pt-4">
                  <h3
                    className="flex items-center gap-2 text-sm font-semibold"
                    id="document-step-heading"
                  >
                    <FileUp aria-hidden="true" size={16} /> Supporting documents
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {selectedService.documentGuidance ||
                      'You can add supporting documents from your ticket after joining.'}
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    After joining, open your ticket and choose <strong>Add document</strong>
                    {selectedService.requiresDocuments ? ' before service starts.' : '.'}
                  </p>
                </section>
              ) : null}
            </div>
          ) : null}

          {joining ? <LoadingMessage>Joining queue…</LoadingMessage> : null}
          {selectionError ? <FeedbackMessage kind="error">{selectionError}</FeedbackMessage> : null}
          {error ? <FeedbackMessage kind="error">{error}</FeedbackMessage> : null}
          {services.length > 1 && !selectedService ? (
            <p className="text-sm text-muted-foreground">
              Choose an available service to see its request form and document requirements.
            </p>
          ) : null}
          <Button
            className="min-h-12 w-full px-5 sm:w-auto"
            disabled={joining || services.length === 0 || !selectedService || !selectedQueue}
            type="submit"
          >
            {joining ? 'Joining queue…' : 'Join queue'}
            {joining ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
          </Button>
        </form>
      </div>
    </MotionConfig>
  )
}
