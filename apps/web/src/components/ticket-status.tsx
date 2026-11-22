import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Check, CircleDot, Clock3, Megaphone, SkipForward } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

type TicketStatusPresentation = {
  label: string
  className: string
  Icon: LucideIcon
}

const statusPresentations: Record<string, TicketStatusPresentation> = {
  NEXT_UP: {
    label: 'Next up',
    className: 'border-brand-green/40 text-brand-green',
    Icon: ArrowRight,
  },
  WAITING: {
    label: 'Waiting',
    className: 'text-muted-foreground',
    Icon: Clock3,
  },
  PENDING: {
    label: 'Called',
    className: 'border-status-info/40 text-status-info',
    Icon: Megaphone,
  },
  OPERATING: {
    label: 'In service',
    className: 'border-brand-green/40 text-brand-green',
    Icon: CircleDot,
  },
  COMPLETED: {
    label: 'Completed',
    className: 'border-status-success/40 text-status-success',
    Icon: Check,
  },
  SKIPPED: {
    label: 'Skipped',
    className: 'border-status-warning/40 text-status-warning',
    Icon: SkipForward,
  },
}

export function ticketStatusLabel(status: string) {
  return statusPresentations[status]?.label ?? (status || 'Unknown status')
}

export function TicketStatus({ status }: { status: string }) {
  const reducedMotion = usePrefersReducedMotion()
  const presentation = statusPresentations[status] ?? {
    label: ticketStatusLabel(status),
    className: 'border-border text-muted-foreground',
    Icon: Clock3,
  }
  const { Icon } = presentation

  return (
    <motion.span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 py-1 text-sm font-medium ${presentation.className}`}
      layout
    >
      <AnimatePresence initial={false}>
        <motion.span
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, scale: 0.85, y: -2 }}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.85, y: 2 }}
          key={status}
          transition={{ duration: reducedMotion ? 0 : 0.14, ease: 'easeOut' }}
        >
          <Icon aria-hidden="true" className="shrink-0" size={14} />
        </motion.span>
      </AnimatePresence>
      {presentation.label}
    </motion.span>
  )
}
