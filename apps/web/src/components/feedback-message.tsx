import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

type FeedbackKind = 'success' | 'error'

type FeedbackProps = {
  kind: FeedbackKind
  children: ReactNode
}

const feedbackStyles = {
  success: 'border-status-success/50 bg-card text-status-success',
  error: 'border-status-danger/50 bg-card text-status-danger',
} satisfies Record<FeedbackKind, string>

export function FeedbackMessage({ kind, children }: FeedbackProps) {
  const reducedMotion = usePrefersReducedMotion()
  const Icon = kind === 'error' ? CircleAlert : CircleCheck

  return (
    <motion.p
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border px-4 py-3 text-sm ${feedbackStyles[kind]}`}
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      role={kind === 'error' ? 'alert' : 'status'}
      transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
    >
      <Icon aria-hidden="true" className="mr-2 inline-block align-[-3px]" size={16} />
      {children}
    </motion.p>
  )
}

export function LoadingMessage({ children }: { children: ReactNode }) {
  return (
    <p
      className="flex items-center gap-2 rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground"
      role="status"
    >
      <LoaderCircle
        aria-hidden="true"
        className="animate-spin motion-reduce:animate-none"
        size={16}
      />
      {children}
    </p>
  )
}
