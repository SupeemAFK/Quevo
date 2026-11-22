import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '@/client/api/schema'
import { CustomerTicketDetails } from './customer-ticket-details'
import { ticketStatusLabel } from './ticket-status'

type Ticket = components['schemas']['queue.TicketResponse']

const ticket: Ticket = {
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

describe('CustomerTicketDetails', () => {
  it.each([
    ['WAITING', 'Waiting'],
    ['PENDING', 'Called'],
    ['OPERATING', 'In service'],
    ['COMPLETED', 'Completed'],
    ['SKIPPED', 'Skipped'],
  ])('shows the %s status as %s', (status, label) => {
    render(
      <CustomerTicketDetails
        feedback={null}
        onRefresh={vi.fn()}
        refreshing={false}
        ticket={{ ...ticket, status }}
      />,
    )

    expect(screen.getByTestId('ticket-number')).toHaveTextContent('12')
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(ticketStatusLabel(status)).toBe(label)
    expect(screen.getByText('General Service')).toBeInTheDocument()
    expect(screen.getByText('Demo Branch')).toBeInTheDocument()
    expect(screen.getByText('2026-11-22')).toBeInTheDocument()
  })

  it('requests an explicit refresh and shows success feedback', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    const { rerender } = render(
      <CustomerTicketDetails
        feedback={null}
        onRefresh={onRefresh}
        refreshing={false}
        ticket={ticket}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Refresh status' }))
    expect(onRefresh).toHaveBeenCalledOnce()
    rerender(
      <CustomerTicketDetails
        feedback={{ message: 'Ticket status updated.', kind: 'success' }}
        onRefresh={onRefresh}
        refreshing={false}
        ticket={ticket}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Ticket status updated.')
  })

  it('keeps ticket details visible while refreshing and announces failures', () => {
    render(
      <CustomerTicketDetails
        feedback={{
          message: 'Could not refresh ticket status. Please try again.',
          kind: 'error',
        }}
        onRefresh={vi.fn()}
        refreshing
        ticket={ticket}
      />,
    )

    expect(screen.getByTestId('ticket-number')).toHaveTextContent('12')
    expect(screen.getByRole('button', { name: 'Refreshing status…' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not refresh ticket status. Please try again.',
    )
  })
})
