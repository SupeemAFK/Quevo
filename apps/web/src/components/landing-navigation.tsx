import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Identity } from '@/lib/auth'
import { FeedbackMessage } from './feedback-message'
import { ThemePreferenceSelect } from './theme-preference-select'
import { Button } from './ui/button'

type Props = {
  user: Identity | null
  onSignOut: () => void
  signOutError: string
}

const sections = [{ href: '#workflows', label: 'How it works' }]

export function LandingNavigation({ user, onSignOut, signOutError }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const appPath = user?.role === 'CUSTOMER' ? '/customer' : '/operator'
  const appLabel = user?.role === 'CUSTOMER' ? 'Open customer queue' : 'Open operator queue'

  function closeMenu() {
    setMenuOpen(false)
  }

  function closeMenuAtSection(href: string) {
    setMenuOpen(false)
    const target = document.getElementById(href.slice(1))
    if (target) {
      target.focus({ preventScroll: true })
    } else {
      menuButtonRef.current?.focus()
    }
  }

  useEffect(() => {
    if (!menuOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="relative mx-auto flex min-h-16 max-w-content items-center justify-between gap-4 px-page">
        <Link
          aria-label="Quevo home"
          className="inline-flex items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight focus-visible:outline"
          onClick={closeMenu}
          to="/"
        >
          <span aria-hidden="true" className="landing-brand-mark">
            Q
          </span>
          Quevo
        </Link>

        <button
          aria-controls="landing-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          ref={menuButtonRef}
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -45, scale: 0.7 }}
              initial={{ opacity: 0, rotate: 45, scale: 0.7 }}
              key={menuOpen ? 'close' : 'open'}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {menuOpen ? (
                <X aria-hidden="true" size={20} />
              ) : (
                <Menu aria-hidden="true" size={20} />
              )}
            </motion.span>
          </AnimatePresence>
        </button>

        <nav
          aria-label="Primary"
          className={`${menuOpen ? 'block' : 'hidden'} absolute left-0 right-0 top-full border-b bg-background p-4 md:static md:block md:border-0 md:bg-transparent md:p-0`}
          id="landing-navigation"
        >
          <ul className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            {sections.map((section) => (
              <li key={section.href}>
                <a
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline"
                  href={section.href}
                  onClick={() => closeMenuAtSection(section.href)}
                >
                  {section.label}
                </a>
              </li>
            ))}
            <li className="flex flex-col gap-2 border-t border-border pt-3 md:flex-row md:border-0 md:pt-0">
              <Link
                className="flex min-h-11 items-center rounded-md px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline"
                onClick={closeMenu}
                to={user ? appPath : '/login'}
              >
                {user ? appLabel : 'Sign in'}
              </Link>
              {user ? (
                <Button className="min-h-11 px-4" onClick={onSignOut} variant="outline">
                  Sign out
                </Button>
              ) : null}
            </li>
            <li className="border-t border-border pt-2 md:border-0 md:pt-0">
              <ThemePreferenceSelect />
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
