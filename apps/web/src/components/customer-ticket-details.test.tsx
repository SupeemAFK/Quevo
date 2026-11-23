import { fireEvent, render, screen } from '@testing-library/react'
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
  queueId: 'queue-1',
  queueName: 'Main queue',
  requestAnswers: {},
  requestLabels: {},
  serviceId: 'service-1',
  serviceName: 'General Service',
  status: 'WAITING',
  ticketNumber: '12',
}

describe('CustomerTicketDetails', () => {
  it.each([
    [
      'WAITING',
      'Waiting',
      "You're in the queue. Keep this page open or check back for updates.",
      'text-muted-foreground',
    ],
    ['PENDING', 'Called', "It's your turn. Please go to the service desk now.", 'text-status-info'],
    [
      'OPERATING',
      'In service',
      'Your service is in progress. Stay with the operator.',
      'text-brand-green',
    ],
    ['COMPLETED', 'Completed', 'Your service is complete.', 'text-status-success'],
    [
      'SKIPPED',
      'Skipped',
      'This ticket was skipped. Please speak with the service desk for guidance.',
      'text-status-warning',
    ],
  ])(
    'shows the %s status as %s with useful guidance and semantic color',
    (status, label, guidance, color) => {
      render(
        <CustomerTicketDetails
          feedback={null}
          onRefresh={vi.fn()}
          refreshing={false}
          ticket={{ ...ticket, status }}
        />,
      )

      expect(screen.getByTestId('ticket-number')).toHaveTextContent('12')
      const statusLabel = screen.getByText(label)
      expect(statusLabel).toBeInTheDocument()
      expect(statusLabel.closest('span.rounded-md')).toHaveClass(color)
      expect(screen.getByText(guidance)).toBeInTheDocument()
      expect(ticketStatusLabel(status)).toBe(label)
      expect(screen.getByText('General Service')).toBeInTheDocument()
      expect(screen.getByText('Demo Branch')).toBeInTheDocument()
      expect(screen.getByText('2026-11-22')).toBeInTheDocument()
    },
  )

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

    await user.tab()
    expect(screen.getByRole('button', { name: 'Refresh status' })).toHaveFocus()
    await user.keyboard('{Enter}')
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

  it('keeps the ticket surface neutral so its status badge carries the state color', () => {
    render(
      <CustomerTicketDetails
        feedback={null}
        onRefresh={vi.fn()}
        refreshing={false}
        ticket={ticket}
      />,
    )

    const ticketSection = screen.getByRole('region', { name: /your ticket number/i })
    expect(ticketSection).toHaveClass('border', 'bg-card')
    expect(ticketSection).not.toHaveClass('before:bg-brand-green')
    expect(ticketSection).toHaveClass('ticket-reflective')
  })

  it('moves a subtle reflection with pointer input and resets the tilt on leave', () => {
    render(
      <CustomerTicketDetails
        feedback={null}
        onRefresh={vi.fn()}
        refreshing={false}
        ticket={ticket}
      />,
    )
    const ticketSection = screen.getByRole('region', { name: /your ticket number/i })
    fireEvent.pointerMove(ticketSection, { pointerType: 'mouse', clientX: 150, clientY: 100 })
    expect(ticketSection.style.getPropertyValue('--ticket-shine-x')).not.toBe('')
    fireEvent.pointerLeave(ticketSection)
    expect(ticketSection.style.getPropertyValue('--ticket-tilt-x')).toBe('0deg')
  })

  it('offers uploads only when the service allows them', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn()
    render(
      <CustomerTicketDetails
        feedback={null}
        onRefresh={vi.fn()}
        onUpload={onUpload}
        refreshing={false}
        ticket={{ ...ticket, allowsUploads: true, documentGuidance: 'Attach the requested form.' }}
      />,
    )
    const file = new File(['%PDF-1.4'], 'proof.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Add document'), file)
    expect(onUpload).toHaveBeenCalledWith(file)
    expect(screen.getByText('Attach the requested form.')).toBeInTheDocument()
  })

  it('keeps ticket details visible and announces loading during a refresh', () => {
    render(<CustomerTicketDetails feedback={null} onRefresh={vi.fn()} refreshing ticket={ticket} />)

    expect(screen.getByTestId('ticket-number')).toHaveTextContent('12')
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing ticket status…')
  })

  it('keeps ticket details visible after a refresh failure', () => {
    render(
      <CustomerTicketDetails
        feedback={{
          message: 'Could not refresh ticket status. Please try again.',
          kind: 'error',
        }}
        onRefresh={vi.fn()}
        refreshing={false}
        ticket={ticket}
      />,
    )

    expect(screen.getByTestId('ticket-number')).toHaveTextContent('12')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not refresh ticket status. Please try again.',
    )
  })
})
