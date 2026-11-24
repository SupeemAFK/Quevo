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
  Trash2,
} from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { components } from '@/client/api/schema'
import { FeedbackMessage, LoadingMessage } from './feedback-message'
import { TicketStatus, ticketStatusLabel } from './ticket-status'
import { Button } from './ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

type ServiceOption = components['schemas']['queue.ServiceResponse']
type ActiveTicket = components['schemas']['queue.TicketResponse']
type ServiceFormValues = { [key: string]: unknown; documents?: File[] }

const maxFiles = 5
const maxFileSize = 10 * 1024 * 1024
const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg']

type CustomerServiceSelectionProps = {
  services: ServiceOption[]
  activeTickets: ActiveTicket[]
  joining: boolean
  error: string
  notice?: string
  onJoin: (
    service: ServiceOption,
    queueID: string,
    requestAnswers: Record<string, string>,
    documents: File[],
  ) => void
}

export function CustomerServiceSelection({
  services,
  activeTickets,
  joining,
  error,
  notice = '',
  onJoin,
}: CustomerServiceSelectionProps) {
  const [selectedServiceID, setSelectedServiceID] = useState('')
  const [selectedQueueID, setSelectedQueueID] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const [previews, setPreviews] = useState<Array<{ file: File; src: string }>>([])
  const joinStartedRef = useRef(false)
  const form = useForm<ServiceFormValues>({ defaultValues: { documents: [] } })
  const documents = useWatch({ control: form.control, name: 'documents' }) ?? []
  const selectedService =
    services.find((service) => service.id === selectedServiceID) ??
    (services.length === 1 ? services[0] : undefined)
  const selectedQueue =
    selectedService?.queues.find((queue) => queue.id === selectedQueueID) ??
    (selectedService?.queues.length === 1 ? selectedService.queues[0] : undefined)

  useEffect(() => {
    const nextPreviews = documents
      .filter((file) => file.type === 'image/png' || file.type === 'image/jpeg')
      .map((file) => ({ file, src: URL.createObjectURL(file) }))
    setPreviews(nextPreviews)
    return () => {
      nextPreviews.forEach(({ src }) => {
        URL.revokeObjectURL(src)
      })
    }
  }, [documents])

  useEffect(() => {
    if (!joining) joinStartedRef.current = false
  }, [joining])

  function selectService(service: ServiceOption) {
    setSelectedServiceID(service.id)
    setSelectedQueueID(service.queues.length === 1 ? service.queues[0].id : '')
    form.reset({ documents: [] })
    setSelectionError('')
  }

  function submit(values: ServiceFormValues) {
    if (joining || joinStartedRef.current) return
    if (!selectedService || !selectedQueue) {
      setSelectionError('Select a service and queue before joining.')
      return
    }
    setSelectionError('')
    joinStartedRef.current = true
    const requestAnswers = Object.fromEntries(
      selectedService.fields.flatMap((field) => {
        const answer = values[field.id]
        return typeof answer === 'string' && answer.trim() ? [[field.id, answer.trim()]] : []
      }),
    )
    onJoin(selectedService, selectedQueue.id, requestAnswers, values.documents ?? [])
  }

  function appendFiles(input: HTMLInputElement, current: File[]) {
    const selected = Array.from(input.files ?? [])
    input.value = ''
    if (!selected.length) return
    const allFiles = [...current]
    for (const file of selected) {
      if (
        !allFiles.some(
          (currentFile) =>
            currentFile.name === file.name &&
            currentFile.size === file.size &&
            currentFile.lastModified === file.lastModified,
        )
      ) {
        allFiles.push(file)
      }
    }
    if (allFiles.length > maxFiles) {
      form.setError('documents', { type: 'validate', message: `Choose up to ${maxFiles} files.` })
      return
    }
    if (selected.some((file) => !allowedMimeTypes.includes(file.type))) {
      form.setError('documents', {
        type: 'validate',
        message: 'Choose a PDF, PNG, or JPG file.',
      })
      return
    }
    if (selected.some((file) => file.size > maxFileSize || file.size === 0)) {
      form.setError('documents', {
        type: 'validate',
        message: 'Each file must be under 10 MB and cannot be empty.',
      })
      return
    }
    form.clearErrors('documents')
    form.setValue('documents', allFiles, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-9">
        {activeTickets.length > 0 ? (
          <section aria-labelledby="active-tickets-heading" className="space-y-4">
            <div className="border-b pb-4">
              <h2
                className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
                id="active-tickets-heading"
              >
                <TicketCheck aria-hidden="true" size={19} />
                Your active ticket
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You can hold one active ticket at a time. Finish or cancel it before joining another
                service.
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
            {notice ? <FeedbackMessage kind="error">{notice}</FeedbackMessage> : null}
            {error ? <FeedbackMessage kind="error">{error}</FeedbackMessage> : null}
          </section>
        ) : (
          <Form {...form}>
            <form className="space-y-6" noValidate onSubmit={form.handleSubmit(submit)}>
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
                            <Check
                              aria-hidden="true"
                              className="shrink-0 text-brand-green"
                              size={17}
                            />
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
                      Queue:{' '}
                      <span className="font-medium text-foreground">{selectedQueue.name}</span>
                    </p>
                  ) : null}

                  {selectedService.fields.length > 0 ? (
                    <fieldset className="space-y-4 border-t pt-5">
                      <legend className="pb-1 text-base font-semibold" id="service-form-heading">
                        A few details for the team
                      </legend>
                      <p className="-mt-2 text-sm text-muted-foreground">
                        This helps the team prepare before your turn.
                      </p>
                      {selectedService.fields.map((field) => (
                        <FormField
                          control={form.control}
                          key={field.id}
                          name={field.id}
                          rules={{
                            validate: (value) => {
                              if (field.required && (typeof value !== 'string' || !value.trim())) {
                                return `${field.label} is required.`
                              }
                              if (typeof value === 'string' && value.length > 200) {
                                return `${field.label} must be 200 characters or fewer.`
                              }
                              return true
                            },
                          }}
                          render={({ field: control }) => (
                            <FormItem>
                              <FormLabel
                                aria-label={field.required ? `${field.label}, required` : undefined}
                              >
                                {field.label}
                                {field.required ? <span aria-hidden="true"> *</span> : null}
                              </FormLabel>
                              {field.type === 'single_select' ? (
                                <Select
                                  onValueChange={control.onChange}
                                  value={typeof control.value === 'string' ? control.value : ''}
                                >
                                  <FormControl>
                                    <SelectTrigger className="min-h-11 w-full">
                                      <SelectValue placeholder="Choose one" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {field.options.map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <FormControl>
                                  <Input
                                    autoComplete="off"
                                    className="min-h-11"
                                    maxLength={200}
                                    onBlur={control.onBlur}
                                    onChange={control.onChange}
                                    name={control.name}
                                    ref={control.ref}
                                    required={field.required}
                                    value={typeof control.value === 'string' ? control.value : ''}
                                  />
                                </FormControl>
                              )}
                              <FormDescription>
                                {field.type === 'single_select'
                                  ? 'Choose one option.'
                                  : 'Enter up to 200 characters.'}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                      <p className="text-xs leading-5 text-muted-foreground">
                        Please don’t enter account or card numbers, ID numbers, passwords, PINs,
                        OTPs, or income details.
                      </p>
                    </fieldset>
                  ) : null}

                  {selectedService.allowsUploads ? (
                    <section
                      aria-labelledby="document-step-heading"
                      className="space-y-3 border-t pt-4"
                    >
                      <div>
                        <h3
                          className="flex items-center gap-2 text-sm font-semibold"
                          id="document-step-heading"
                        >
                          <FileUp aria-hidden="true" size={16} /> Supporting documents
                          {selectedService.requiresDocuments ? (
                            <span aria-hidden="true" className="text-destructive">
                              *
                            </span>
                          ) : null}
                          {selectedService.requiresDocuments ? (
                            <span className="sr-only"> required</span>
                          ) : null}
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          {selectedService.documentGuidance ||
                            'Upload any supporting documents requested by the branch.'}
                        </p>
                      </div>
                      <FormField
                        control={form.control}
                        name="documents"
                        rules={{
                          validate: (files) =>
                            !selectedService.requiresDocuments ||
                            (files?.length ?? 0) > 0 ||
                            'Add at least one required document before joining.',
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Upload files</FormLabel>
                            <FormDescription>
                              PDF, JPG, or PNG · up to {maxFiles} files · 10 MB each.{' '}
                              {selectedService.requiresDocuments
                                ? 'At least one file is required. '
                                : 'Files are optional. '}
                              Selected files are uploaded to your ticket as soon as it is created.
                            </FormDescription>
                            <FormControl>
                              <Input
                                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                                className="min-h-11 py-2"
                                disabled={joining || documents.length >= maxFiles}
                                multiple
                                onChange={(event) =>
                                  appendFiles(event.currentTarget, field.value ?? [])
                                }
                                type="file"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {documents.length ? (
                        <ul aria-label="Selected documents" className="space-y-2">
                          {documents.map((file) => {
                            const preview = previews.find((item) => item.file === file)
                            return (
                              <li
                                className="flex min-w-0 items-center gap-3 rounded-md border p-2"
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                              >
                                {preview ? (
                                  <img
                                    alt={`Preview of ${file.name}`}
                                    className="size-14 shrink-0 rounded border object-cover"
                                    src={preview.src}
                                  />
                                ) : (
                                  <span className="grid size-14 shrink-0 place-items-center rounded border text-muted-foreground">
                                    <FileUp aria-hidden="true" size={20} />
                                  </span>
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {file.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </span>
                                </span>
                                <Button
                                  aria-label={`Remove ${file.name}`}
                                  className="size-10 shrink-0"
                                  onClick={() =>
                                    form.setValue(
                                      'documents',
                                      documents.filter((selectedFile) => selectedFile !== file),
                                      { shouldDirty: true, shouldValidate: true },
                                    )
                                  }
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 aria-hidden="true" size={16} />
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              ) : null}

              {joining ? (
                <LoadingMessage>
                  {documents.length ? 'Joining queue and uploading documents…' : 'Joining queue…'}
                </LoadingMessage>
              ) : null}
              {selectionError ? (
                <FeedbackMessage kind="error">{selectionError}</FeedbackMessage>
              ) : null}
              {error ? <FeedbackMessage kind="error">{error}</FeedbackMessage> : null}
              {notice ? <FeedbackMessage kind="error">{notice}</FeedbackMessage> : null}
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
                {joining
                  ? documents.length
                    ? 'Uploading documents…'
                    : 'Joining queue…'
                  : 'Join queue'}
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
          </Form>
        )}
      </div>
    </MotionConfig>
  )
}
