import {
  CalendarDays,
  FileUp,
  Layers3,
  MapPin,
  RefreshCw,
  Ticket as TicketIcon,
  X,
} from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useRef, useState } from 'react'
import type { components } from '@/client/api/schema'
import type { TicketDocument } from '@/lib/ticket-documents'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
import { FeedbackMessage, LoadingMessage } from './feedback-message'
import { TicketStatus } from './ticket-status'
import { Button } from './ui/button'

type Ticket = components['schemas']['queue.TicketResponse']
type Feedback = { message: string; kind: 'success' | 'error' } | null

type Props = {
  ticket: Ticket
  refreshing: boolean
  feedback: Feedback
  onRefresh: () => void
  documents?: TicketDocument[]
  documentsError?: string
  uploading?: boolean
  cancelling?: boolean
  onUpload?: (file: File) => void
  onCancel?: () => void
}

const statusGuidance: Record<string, string> = {
  WAITING: "You're in the queue. Keep this page open or check back for updates.",
  PENDING: "It's your turn. Please go to the service desk now.",
  OPERATING: 'Your service is in progress. Stay with the operator.',
  COMPLETED: 'Your service is complete.',
  SKIPPED: 'This ticket was skipped. Please speak with the service desk for guidance.',
  CANCELLED:
    'This ticket was cancelled. You can join an active service again if you still need help.',
  NO_SHOW: 'This ticket was marked no-show. Please speak with the service desk about next steps.',
}

export function CustomerTicketDetails({
  ticket,
  refreshing,
  feedback,
  onRefresh,
  documents = [],
  documentsError = '',
  uploading = false,
  cancelling = false,
  onUpload,
  onCancel,
}: Props) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const ticketSurface = useRef<HTMLElement>(null)
  const [fileError, setFileError] = useState('')
  const guidance =
    statusGuidance[ticket.status] ?? 'Refresh this page to check your ticket status again.'

  function reflectPointer(event: React.PointerEvent<HTMLElement>) {
    if (prefersReducedMotion || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    event.currentTarget.style.setProperty('--ticket-shine-x', `${x * 100}%`)
    event.currentTarget.style.setProperty('--ticket-shine-y', `${y * 100}%`)
    event.currentTarget.style.setProperty('--ticket-tilt-x', `${(0.5 - y) * 5}deg`)
    event.currentTarget.style.setProperty('--ticket-tilt-y', `${(x - 0.5) * 5}deg`)
  }

  function resetReflection(event: React.PointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty('--ticket-tilt-x', '0deg')
    event.currentTarget.style.setProperty('--ticket-tilt-y', '0deg')
  }

  function onChooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setFileError('')
    if (!file || !onUpload) return
    if (file.size > 10 * 1024 * 1024) {
      setFileError('Files must be 10 MB or smaller.')
      return
    }
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
      setFileError('Upload a PDF, PNG, or JPG file.')
      return
    }
    onUpload(file)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Layers3 aria-hidden="true" size={16} />
              {ticket.serviceName}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw aria-hidden="true" size={14} />
              Status updates load when you open this page. Refresh to check again.
            </p>
          </div>
          <Button
            className="min-h-11 px-4"
            disabled={refreshing}
            onClick={() => {
              if (!refreshing) onRefresh()
            }}
            variant="outline"
          >
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? 'animate-spin motion-reduce:animate-none' : undefined}
            />
            {refreshing ? 'Refreshing…' : 'Refresh status'}
          </Button>
        </div>

        <section
          aria-labelledby="ticket-number-heading"
          className="ticket-reflective rounded-xl border bg-card p-5 shadow-sm sm:p-8"
          onPointerLeave={resetReflection}
          onPointerMove={reflectPointer}
          ref={ticketSurface}
        >
          <div className="relative z-10 mb-6 flex items-center justify-between gap-4 border-b pb-4">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <TicketIcon aria-hidden="true" size={15} /> Quevo digital ticket
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {ticket.queueName || 'Queue'}
            </span>
          </div>
          <div className="relative z-10">
            <p
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"
              id="ticket-number-heading"
            >
              <TicketIcon aria-hidden="true" size={16} />
              Your ticket number
            </p>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 break-words font-mono text-6xl font-semibold tabular-nums tracking-[-0.06em] sm:text-7xl"
                data-testid="ticket-number"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                key={ticket.ticketNumber}
                transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
              >
                {ticket.ticketNumber}
              </motion.p>
            </AnimatePresence>

            <div className="mt-7 border-t pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Current status</span>
                <TicketStatus status={ticket.status} />
              </div>
              <AnimatePresence initial={false}>
                <motion.p
                  aria-atomic="true"
                  aria-live="polite"
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 max-w-2xl leading-6"
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                  initial={false}
                  key={ticket.status}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16 }}
                >
                  {guidance}
                </motion.p>
              </AnimatePresence>
            </div>

            <dl className="mt-7 grid grid-cols-1 gap-x-6 gap-y-4 border-t pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin aria-hidden="true" size={14} />
                  Branch
                </dt>
                <dd className="mt-1 font-medium">{ticket.branchName}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays aria-hidden="true" size={14} />
                  Business date
                </dt>
                <dd className="mt-1 font-medium">{ticket.businessDate}</dd>
              </div>
            </dl>
          </div>

          {ticket.allowsUploads && onUpload ? (
            <div className="relative z-10 mt-7 border-t pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-xl">
                  <p className="flex items-center gap-2 font-semibold">
                    <FileUp aria-hidden="true" size={17} /> Supporting documents
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {ticket.documentGuidance || 'Upload a PDF, JPG, or PNG file up to 10 MB.'}
                  </p>
                  {ticket.requiresDocuments ? (
                    <p className="mt-1 text-sm font-medium">
                      {documents.length
                        ? `${documents.length} document${documents.length === 1 ? '' : 's'} attached`
                        : 'Required before service starts'}
                    </p>
                  ) : null}
                </div>
                {ticket.status === 'WAITING' || ticket.status === 'PENDING' ? (
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
                    <FileUp aria-hidden="true" size={16} />
                    {uploading ? 'Uploading…' : 'Add document'}
                    <input
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      className="sr-only"
                      disabled={uploading || documents.length >= 5}
                      onChange={onChooseFile}
                      type="file"
                    />
                  </label>
                ) : null}
              </div>
              {fileError || documentsError ? (
                <p className="mt-3 text-sm text-status-danger" role="alert">
                  {fileError || documentsError}
                </p>
              ) : null}
              {documents.length ? (
                <ul className="mt-4 divide-y border-y">
                  {documents.map((document) => (
                    <li
                      className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm"
                      key={document.id}
                    >
                      <span className="min-w-0 truncate">
                        {document.fileName}{' '}
                        <span className="text-muted-foreground">
                          · {(document.byteSize / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </span>
                      <a
                        className="shrink-0 rounded-sm underline underline-offset-4 focus-visible:outline"
                        href={`/api/tickets/${encodeURIComponent(ticket.id)}/documents/${encodeURIComponent(document.id)}`}
                      >
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {onCancel && ticket.status === 'WAITING' ? (
            <div className="relative z-10 mt-5 flex justify-end border-t pt-4">
              <Button
                className="min-h-10"
                disabled={cancelling}
                onClick={onCancel}
                variant="outline"
              >
                <X aria-hidden="true" />
                {cancelling ? 'Cancelling…' : 'Leave queue'}
              </Button>
            </div>
          ) : null}
        </section>

        {refreshing ? <LoadingMessage>Refreshing ticket status…</LoadingMessage> : null}
        {feedback ? (
          <FeedbackMessage kind={feedback.kind}>{feedback.message}</FeedbackMessage>
        ) : null}
      </div>
    </MotionConfig>
  )
}
