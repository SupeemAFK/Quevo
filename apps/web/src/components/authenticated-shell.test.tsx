import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Identity } from '@/lib/auth'
import { AuthenticatedShell } from './authenticated-shell'

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  navigate: vi.fn(),
  removeQueries: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ removeQueries: mocks.removeQueries }),
}))

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
  useRouter: () => ({ invalidate: mocks.invalidate, navigate: mocks.navigate }),
}))

vi.mock('@/lib/auth', () => ({ signOut: mocks.signOut }))

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

describe('AuthenticatedShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signOut.mockResolvedValue(undefined)
  })

  it('shows the customer queue as the current role-appropriate destination', () => {
    render(
      <AuthenticatedShell currentSection="customer" user={customer}>
        <h1>Customer page</h1>
      </AuthenticatedShell>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Application' })
    expect(screen.getByRole('link', { name: 'Customer queue' })).toHaveAttribute(
      'href',
      '/customer',
    )
    expect(screen.getByRole('link', { name: 'Customer queue' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.queryByRole('link', { name: 'Operator queue' })).not.toBeInTheDocument()
    expect(navigation).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#app-main',
    )
  })

  it('shows the operator queue and signs out to the public landing page', async () => {
    const user = userEvent.setup()
    render(
      <AuthenticatedShell currentSection="operator" user={operator}>
        <h1>Operator page</h1>
      </AuthenticatedShell>,
    )

    const queueLink = screen.getByRole('link', { name: 'Operator queue' })
    expect(queueLink).toHaveAttribute('href', '/operator')
    expect(queueLink).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Customer queue' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce())
    expect(mocks.removeQueries).toHaveBeenNthCalledWith(1, { queryKey: ['customer'] })
    expect(mocks.removeQueries).toHaveBeenNthCalledWith(2, { queryKey: ['operator'] })
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
    expect(mocks.invalidate).toHaveBeenCalledOnce()
    expect(mocks.invalidate.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.navigate.mock.invocationCallOrder[0],
    )
  })

  it('announces a failed sign-out attempt', async () => {
    const user = userEvent.setup()
    mocks.signOut.mockRejectedValueOnce(new Error('service unavailable'))
    render(
      <AuthenticatedShell currentSection="customer" user={customer}>
        <h1>Customer page</h1>
      </AuthenticatedShell>,
    )

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not sign out. Please try again.',
    )
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
