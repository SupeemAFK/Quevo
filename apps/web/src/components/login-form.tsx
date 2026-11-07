import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Identity, LoginInput } from '@/lib/auth'

type LoginFormProps = {
  signIn: (input: LoginInput) => Promise<Identity>
  onSuccess?: () => void
}

export function LoginForm({ signIn, onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)
    setPassword('')

    try {
      await signIn({ email, password })
      setMessage('Signed in successfully.')
      onSuccess?.()
    } catch {
      setMessage('Sign in failed. Check your email and password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="grid gap-5" method="post" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground" role="status">
        {message}
      </p>
    </form>
  )
}
