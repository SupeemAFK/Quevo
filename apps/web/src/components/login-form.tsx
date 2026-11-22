import { LoaderCircle, LockKeyhole, LogIn, Mail } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { Button } from '@/components/ui/button'
import type { Identity, LoginInput } from '@/lib/auth'

type LoginFormProps = {
  signIn: (input: LoginInput) => Promise<Identity>
  onSuccess?: () => void
}

export function LoginForm({ signIn, onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error'
    message: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setFeedback(null)
    setIsSubmitting(true)
    setPassword('')

    try {
      await signIn({ email, password })
      setFeedback({ kind: 'success', message: 'Signed in successfully.' })
      onSuccess?.()
    } catch {
      setFeedback({ kind: 'error', message: 'Sign in failed. Check your email and password.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="grid gap-5" method="post" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-medium" htmlFor="email">
          <Mail aria-hidden="true" className="text-muted-foreground" size={16} />
          Email
        </label>
        <input
          autoComplete="email"
          className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-medium" htmlFor="password">
          <LockKeyhole aria-hidden="true" className="text-muted-foreground" size={16} />
          Password
        </label>
        <input
          autoComplete="current-password"
          className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      <Button
        aria-disabled={isSubmitting}
        className="min-h-11 w-full aria-disabled:pointer-events-none aria-disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <LogIn aria-hidden="true" />
        )}
        Sign in
      </Button>
      <div className="min-h-5">
        {isSubmitting ? <LoadingMessage>Signing in…</LoadingMessage> : null}
        {feedback ? (
          <FeedbackMessage kind={feedback.kind}>{feedback.message}</FeedbackMessage>
        ) : null}
      </div>
    </form>
  )
}
