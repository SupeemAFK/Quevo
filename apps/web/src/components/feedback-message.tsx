import type { ReactNode } from 'react'

type FeedbackKind = 'success' | 'error'

type FeedbackProps = {
  kind: FeedbackKind
  children: ReactNode
}

const feedbackStyles = {
  success: 'border-status-success/30 bg-status-success-surface text-status-success',
  error: 'border-status-danger/30 bg-status-danger-surface text-status-danger',
} satisfies Record<FeedbackKind, string>

export function FeedbackMessage({ kind, children }: FeedbackProps) {
  return (
    <p
      className={`rounded-lg border px-4 py-3 text-sm ${feedbackStyles[kind]}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  )
}

export function LoadingMessage({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
      role="status"
    >
      {children}
    </p>
  )
}
