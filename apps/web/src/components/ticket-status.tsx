type TicketStatusPresentation = {
  label: string
  className: string
}

const statusPresentations: Record<string, TicketStatusPresentation> = {
  WAITING: {
    label: 'Waiting',
    className: 'border-status-info/40 text-status-info',
  },
  PENDING: {
    label: 'Called',
    className: 'border-status-info/40 text-status-info',
  },
  OPERATING: {
    label: 'In service',
    className: 'border-status-warning/40 text-status-warning',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'border-status-success/40 text-status-success',
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
      className={`inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-sm font-medium ${presentation.className}`}
    >
      {presentation.label}
    </span>
  )
}
