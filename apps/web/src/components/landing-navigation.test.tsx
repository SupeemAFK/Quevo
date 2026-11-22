import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Identity } from '@/lib/auth'
import { LandingNavigation } from './landing-navigation'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

const customer: Identity = {
  id: 'customer-1',
  displayName: 'Demo Customer',
  role: 'CUSTOMER',
}
const operator: Identity = {
  id: 'operator-1',
  displayName: 'Demo Operator',
  role: 'OPERATOR',
}

describe('LandingNavigation', () => {
  it('provides section links and opens the existing sign-in route', () => {
    render(<LandingNavigation onSignOut={vi.fn()} signOutError="" user={null} />)

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Try the queue demo' })).toHaveAttribute(
      'href',
      '#queue-demo',
    )
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#workflows')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('exposes and closes the mobile menu with keyboard-operable controls', async () => {
    const user = userEvent.setup()
    render(<LandingNavigation onSignOut={vi.fn()} signOutError="" user={null} />)
    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(menuButton).toHaveAttribute('aria-controls', 'landing-navigation')

    await user.tab()
    await user.tab()
    expect(menuButton).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    await user.click(screen.getByRole('link', { name: 'How it works' }))
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.tab()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('shows only the signed-in customer destination and preserves sign out', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn()
    render(<LandingNavigation onSignOut={onSignOut} signOutError="" user={customer} />)

    expect(screen.getByRole('link', { name: 'Open customer queue' })).toHaveAttribute(
      'href',
      '/customer',
    )
    expect(screen.queryByRole('link', { name: 'Open operator queue' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('shows the operator destination and announces sign-out errors', () => {
    render(
      <LandingNavigation
        onSignOut={vi.fn()}
        signOutError="Could not sign out. Please try again."
        user={operator}
      />,
    )

    expect(screen.getByRole('link', { name: 'Open operator queue' })).toHaveAttribute(
      'href',
      '/operator',
    )
    expect(screen.queryByRole('link', { name: 'Open customer queue' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not sign out. Please try again.')
  })
})
