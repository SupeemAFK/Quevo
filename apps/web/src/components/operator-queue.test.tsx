import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '@/client/api/schema'
import { OperatorQueue } from './operator-queue'

type Detail = components['schemas']['queue.OperatorQueueDetailResponse']

const ticket = {
  id: 'ticket-1',
  ticketNumber: '1',
  status: 'WAITING',
  businessDate: '2026-11-08',
  joinedAt: '2026-11-08T10:00:00Z',
}
const detail: Detail = {
  queue: {
    branchId: 'branch',
    branchName: 'Branch',
    serviceId: 'service',
    serviceName: 'Service',
    businessDate: '2026-11-08',
    waitingCount: 1,
  },
  waiting: [ticket],
}

describe('OperatorQueue', () => {
  it('shows only actions allowed by the current ticket state', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const props = { busy: false, message: '', error: '', onAction, onRefresh: vi.fn() }
    const { rerender } = render(<OperatorQueue {...props} detail={detail} />)
    await user.click(screen.getByRole('button', { name: 'Call next' }))
    expect(onAction).toHaveBeenCalledWith('call-next')

    rerender(
      <OperatorQueue
        {...props}
        detail={{ ...detail, current: { ...ticket, status: 'PENDING' } }}
      />,
    )
    expect(screen.getByText('Called', { exact: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start service' }))
    await user.click(screen.getByRole('button', { name: 'Skip ticket' }))
    expect(onAction).toHaveBeenCalledWith('start')
    expect(onAction).toHaveBeenCalledWith('skip')
    expect(screen.queryByRole('button', { name: 'Complete service' })).not.toBeInTheDocument()

    rerender(
      <OperatorQueue
        {...props}
        detail={{ ...detail, current: { ...ticket, status: 'OPERATING' } }}
      />,
    )
    expect(screen.getByText('In service', { exact: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Complete service' }))
    expect(onAction).toHaveBeenCalledWith('complete')
    expect(screen.queryByRole('button', { name: 'Skip ticket' })).not.toBeInTheDocument()
  })

  it('shows an empty queue and disables calling when nobody is waiting', () => {
    render(
      <OperatorQueue
        detail={{ ...detail, waiting: [] }}
        busy={false}
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText('No customers are waiting in this queue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Call next' })).toBeDisabled()
  })

  it('makes the selected queue context and waiting order easy to scan', () => {
    render(
      <OperatorQueue
        detail={{ ...detail, waiting: [ticket, { ...ticket, id: 'ticket-2', ticketNumber: '2' }] }}
        busy={false}
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByText('Service · Branch')).toBeInTheDocument()
    expect(screen.getByText('2 tickets', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Customers waiting in order' })).toBeInTheDocument()
    expect(screen.getByText('Ticket 1')).toBeInTheDocument()
    expect(screen.getByText('Ticket 2')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting', { exact: true })).toHaveLength(2)
  })

  it('disables queue actions while a request is pending and retains the current ticket', () => {
    render(
      <OperatorQueue
        detail={{ ...detail, current: { ...ticket, status: 'PENDING' } }}
        busy
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByTestId('operator-current-ticket')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start service' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Skip ticket' })).toBeDisabled()
  })
})
