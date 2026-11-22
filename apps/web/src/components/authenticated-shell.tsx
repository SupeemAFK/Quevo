import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, ListOrdered, LogOut } from 'lucide-react'
import { useState } from 'react'
import type { Identity } from '@/lib/auth'
import { signOut } from '@/lib/auth'
import { FeedbackMessage } from './feedback-message'
import { QuevoMark } from './quevo-mark'
import { ThemePreferenceSelect } from './theme-preference-select'
import { Button } from './ui/button'

type Props = {
  user: Identity
  currentSection: 'customer' | 'operator'
  children: React.ReactNode
}

export function AuthenticatedShell({ user, currentSection, children }: Props) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [signOutError, setSignOutError] = useState('')
  const isCustomer = user.role === 'CUSTOMER'
  const queuePath = isCustomer ? '/customer' : '/operator'
  const queueLabel = isCustomer ? 'Choose a service' : 'Operator queue'
  const roleLabel = isCustomer ? 'Customer' : 'Operator'

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
      queryClient.removeQueries({ queryKey: ['customer'] })
      queryClient.removeQueries({ queryKey: ['operator'] })
      await router.navigate({ to: '/' })
      await router.invalidate()
    } catch {
      setSignOutError('Could not sign out. Please try again.')
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        className="sr-only fixed left-4 top-4 z-50 rounded-md border bg-card px-4 py-3 text-foreground focus:not-sr-only focus:ring-2 focus:ring-ring"
        href="#app-main"
      >
        Skip to main content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-3 px-page py-3">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <Link
              aria-label="Quevo home"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md text-lg font-semibold tracking-tight focus-visible:outline"
              to="/"
            >
              <QuevoMark className="size-6 shrink-0" />
              Quevo
            </Link>
            <nav aria-label="Application" className="flex items-center">
              <Link
                aria-current={
                  currentSection === (isCustomer ? 'customer' : 'operator') ? 'page' : undefined
                }
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
                to={queuePath}
              >
                <ListOrdered aria-hidden="true" className="mr-2" size={16} />
                {queueLabel}
                <ArrowRight aria-hidden="true" className="ml-2" size={15} />
              </Link>
            </nav>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3">
            <ThemePreferenceSelect />
            <span className="max-w-[min(42vw,12rem)] text-right text-sm leading-tight text-muted-foreground sm:max-w-48">
              <span className="block break-words font-medium text-foreground">
                {user.displayName}
              </span>
              <span className="hidden text-xs sm:block">{roleLabel}</span>
            </span>
            <Button
              className="min-h-11 px-4"
              onClick={() => void handleSignOut()}
              variant="outline"
            >
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
        {signOutError ? (
          <div className="mx-auto max-w-content px-page pb-3">
            <FeedbackMessage kind="error">{signOutError}</FeedbackMessage>
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-content px-page py-8 sm:py-10" id="app-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
