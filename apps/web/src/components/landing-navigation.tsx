import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import type { Identity } from '@/lib/auth'
import { FeedbackMessage } from './feedback-message'
import { Button } from './ui/button'

type Props = {
  user: Identity | null
  onSignOut: () => void
  signOutError: string
}

const sections = [
  { href: '#queue-demo', label: 'Try the queue demo' },
  { href: '#workflows', label: 'How it works' },
]

export function LandingNavigation({ user, onSignOut, signOutError }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const appPath = user?.role === 'CUSTOMER' ? '/customer' : '/operator'
  const appLabel = user?.role === 'CUSTOMER' ? 'Open customer queue' : 'Open operator queue'

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="relative mx-auto flex min-h-16 max-w-content items-center justify-between gap-4 px-page">
        <Link
          aria-label="Quevo home"
          className="inline-flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight focus-visible:outline"
          onClick={closeMenu}
          to="/"
        >
          <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
          Quevo
        </Link>

        <button
          aria-controls="landing-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
        </button>

        <nav
          aria-label="Primary"
          className={`${menuOpen ? 'block' : 'hidden'} absolute left-0 right-0 top-full border-b bg-background p-4 shadow-lg md:static md:block md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
          id="landing-navigation"
        >
          <ul className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            {sections.map((section) => (
              <li key={section.href}>
                <a
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline"
                  href={section.href}
                  onClick={closeMenu}
                >
                  {section.label}
                </a>
              </li>
            ))}
            <li className="flex flex-col gap-2 border-t border-border pt-3 md:flex-row md:border-0 md:pt-0">
              <Button asChild className="min-h-11 px-4">
                <Link onClick={closeMenu} to={user ? appPath : '/login'}>
                  {user ? appLabel : 'Sign in'}
                </Link>
              </Button>
              {user ? (
                <Button className="min-h-11 px-4" onClick={onSignOut} variant="outline">
                  Sign out
                </Button>
              ) : null}
            </li>
          </ul>
          {signOutError ? (
            <div className="mt-3">
              <FeedbackMessage kind="error">{signOutError}</FeedbackMessage>
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  )
}
