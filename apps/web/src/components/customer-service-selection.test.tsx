import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '@/client/api/schema'
import { CustomerServiceSelection } from './customer-service-selection'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    children: ReactNode
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to.replace('$ticketId', params?.ticketId ?? '')} {...props}>
      {children}
    </a>
  ),
}))

type ActiveTicket = components['schemas']['queue.TicketResponse']

describe('CustomerServiceSelection', () => {
  it('supports keyboard service selection and queue joining', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    const services = [
      {
        id: 'service-1',
        branchId: 'branch-1',
        branchName: 'Demo Branch',
        name: 'General Service',
      },
    ]
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={services}
      />,
    )

    await user.tab()
    expect(screen.getByRole('button', { name: 'General Service at Demo Branch' })).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'General Service at Demo Branch' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'Join queue' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onJoin).toHaveBeenCalledWith(services[0])
  })

  it('requires a service selection before joining', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    const services = [
      {
        id: 'service-1',
        branchId: 'branch-1',
        branchName: 'Demo Branch',
        name: 'General Service',
      },
    ]

    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={services}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Join queue' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select a service before joining the queue.',
    )
    expect(onJoin).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'General Service at Demo Branch' }))
    expect(screen.getByRole('button', { name: 'General Service at Demo Branch' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Join queue' }))

    expect(onJoin).toHaveBeenCalledWith(services[0])
  })

  it('shows a clear empty state when no active service is available', () => {
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={vi.fn()}
        services={[]}
      />,
    )

    expect(
      screen.getByText('No active services are available right now. Check again later.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join queue' })).toBeDisabled()
  })

  it('keeps active tickets distinct and links directly to their ticket view', () => {
    const ticket: ActiveTicket = {
      id: 'ticket-1',
      branchId: 'branch-1',
      branchName: 'Demo Branch',
      businessDate: '2026-11-22',
      joinedAt: '2026-11-22T10:00:00Z',
      serviceId: 'service-1',
      serviceName: 'General Service',
      status: 'WAITING',
      ticketNumber: '12',
    }

    render(
      <CustomerServiceSelection
        activeTickets={[ticket]}
        error=""
        joining={false}
        onJoin={vi.fn()}
        services={[
          {
            id: 'service-1',
            branchId: 'branch-1',
            branchName: 'Demo Branch',
            name: 'General Service',
          },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Your active tickets' })).toBeInTheDocument()
    expect(screen.getByText('12', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Waiting', { exact: true })).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'View ticket 12 (General Service at Demo Branch). Status: Waiting',
      }),
    ).toHaveAttribute('href', '/tickets/ticket-1')
    expect(screen.getByRole('button', { name: 'Join queue' })).toBeEnabled()
  })

  it('communicates pending work and prevents a second selection or submission', () => {
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining
        onJoin={vi.fn()}
        services={[
          {
            id: 'service-1',
            branchId: 'branch-1',
            branchName: 'Demo Branch',
            name: 'General Service',
          },
        ]}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Joining queue…')
    expect(screen.getByRole('button', { name: 'Join queue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join queue' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: 'General Service at Demo Branch' })).toBeDisabled()
  })
})
