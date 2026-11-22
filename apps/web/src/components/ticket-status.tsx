type TicketStatusPresentation = {
  label: string
  className: string
}

const statusPresentations: Record<string, TicketStatusPresentation> = {
  NEXT_UP: {
    label: 'Next up',
    className: 'text-brand-green',
  },
  WAITING: {
    label: 'Waiting',
    className: 'text-muted-foreground',
  },
  PENDING: {
    label: 'Called',
    className: 'text-brand-green',
  },
  OPERATING: {
    label: 'In service',
    className: 'text-brand-green',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'text-status-success',
  },
  SKIPPED: {
    label: 'Skipped',
    className: 'border-border text-muted-foreground',
  },
}

export function ticketStatusLabel(status: string) {
  return statusPresentations[status]?.label ?? (status || 'Unknown status')
}

export function TicketStatus({ status }: { status: string }) {
  const presentation = statusPresentations[status] ?? {
    label: ticketStatusLabel(status),
    className: 'border-border text-muted-foreground',
  }

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border border-border px-2.5 py-1 text-sm font-medium ${presentation.className}`}
    >
      {presentation.label}
    </span>
  )
}
