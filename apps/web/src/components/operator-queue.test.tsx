import { render, screen, within } from '@testing-library/react'
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
  it('supports keyboard queue refresh and call-next in focus order', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onRefresh = vi.fn()
    render(
      <OperatorQueue
        detail={detail}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error=""
        onAction={onAction}
        onRefresh={onRefresh}
      />,
    )

    await user.tab()
    expect(screen.getByRole('button', { name: 'Refresh queue' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Call next' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onAction).toHaveBeenCalledWith('call-next')
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('shows only actions allowed by the current ticket state', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const props = {
      busy: false,
      refreshing: false,
      pendingAction: null,
      message: '',
      error: '',
      onAction,
      onRefresh: vi.fn(),
    }
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

  it('offers a handoff only for the operator current ticket', async () => {
    const user = userEvent.setup()
    const onHandoff = vi.fn()
    const props = {
      detail,
      busy: false,
      refreshing: false,
      pendingAction: null,
      message: '',
      error: '',
      onAction: vi.fn(),
      onRefresh: vi.fn(),
      onHandoff,
    }
    const { rerender } = render(<OperatorQueue {...props} />)
    expect(screen.queryByRole('button', { name: 'Transfer ticket' })).not.toBeInTheDocument()

    rerender(
      <OperatorQueue
        {...props}
        detail={{ ...detail, current: { ...ticket, status: 'PENDING' } }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Transfer ticket' }))
    expect(onHandoff).toHaveBeenCalledOnce()
  })

  it('shows a concise empty state without an unavailable call action', () => {
    render(
      <OperatorQueue
        detail={{ ...detail, waiting: [] }}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText('No customers are waiting.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Call next' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeEnabled()
  })

  it('makes the selected queue context and waiting order easy to scan', () => {
    render(
      <OperatorQueue
        detail={{ ...detail, waiting: [ticket, { ...ticket, id: 'ticket-2', ticketNumber: '2' }] }}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByText('Service', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Branch', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('2 tickets', { exact: true })).toBeInTheDocument()
    const waitingList = screen.getByRole('list', { name: 'Customers waiting in order' })
    expect(waitingList).toBeInTheDocument()
    expect(screen.getByText('Ticket 1')).toBeInTheDocument()
    expect(screen.getByText('Ticket 2')).toBeInTheDocument()
    expect(within(waitingList).getAllByRole('listitem')[0]).toHaveAttribute('aria-posinset', '1')
    expect(within(waitingList).getAllByRole('listitem')[1]).toHaveAttribute('aria-posinset', '2')
    expect(within(waitingList).getAllByText('Waiting', { exact: true })).toHaveLength(2)
  })

  it('disables queue actions while a request is pending and retains the current ticket', () => {
    render(
      <OperatorQueue
        detail={{ ...detail, current: { ...ticket, status: 'PENDING' } }}
        busy
        refreshing
        pendingAction="start"
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByTestId('operator-current-ticket')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start service' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Skip ticket' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Starting service…')
  })

  it('announces a manual queue refresh once and prevents overlapping refreshes', () => {
    render(
      <OperatorQueue
        detail={detail}
        busy={false}
        refreshing
        pendingAction={null}
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Refreshing queue…')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  })

  it('uses one status announcement for success and an alert for errors', () => {
    const props = {
      detail: { ...detail, current: { ...ticket, status: 'OPERATING' } },
      busy: false,
      refreshing: false,
      pendingAction: null,
      onAction: vi.fn(),
      onRefresh: vi.fn(),
      error: '',
    }
    const { rerender } = render(<OperatorQueue {...props} message="Service started." />)

    expect(screen.getByRole('status')).toHaveTextContent('Service started.')
    rerender(
      <OperatorQueue
        {...props}
        message=""
        error="Could not update ticket. Refresh the queue and try again."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Refresh the queue and try again.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps ticket content and actions available when reduced motion is preferred', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation((media) => {
      const eventListener = vi.fn()
      return {
        matches: media === '(prefers-reduced-motion: reduce)',
        media,
        onchange: null,
        addListener: eventListener,
        removeListener: eventListener,
        addEventListener: eventListener,
        removeEventListener: eventListener,
        dispatchEvent: vi.fn(() => true),
      } as unknown as MediaQueryList
    })

    render(
      <OperatorQueue
        detail={{ ...detail, current: { ...ticket, status: 'PENDING' } }}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByTestId('operator-current-ticket')).toHaveTextContent('1')
    expect(screen.getByText('Called', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start service' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Skip ticket' })).toBeEnabled()
    matchMedia.mockRestore()
  })

  it('keeps API-provided queue state unchanged when an action fails', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const props = {
      detail,
      busy: false,
      refreshing: false,
      pendingAction: null,
      message: '',
      onAction,
      onRefresh: vi.fn(),
    }
    const { rerender } = render(<OperatorQueue {...props} error="" />)

    const callNext = screen.getByRole('button', { name: 'Call next' })
    callNext.focus()
    await user.click(callNext)
    expect(onAction).toHaveBeenCalledWith('call-next')
    rerender(
      <OperatorQueue
        {...props}
        error="Could not call the next customer. Refresh the queue and try again."
      />,
    )

    expect(screen.getByText('Ticket 1')).toBeInTheDocument()
    expect(screen.queryByTestId('operator-current-ticket')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Refresh the queue and try again.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Call next' })).toHaveFocus()
  })

  it('moves keyboard focus to the next valid action after a confirmed transition', async () => {
    const user = userEvent.setup()
    const props = {
      busy: false,
      refreshing: false,
      pendingAction: null,
      message: '',
      error: '',
      onAction: vi.fn(),
      onRefresh: vi.fn(),
    }
    const { rerender } = render(<OperatorQueue {...props} detail={detail} />)
    await user.click(screen.getByRole('button', { name: 'Call next' }))

    rerender(
      <OperatorQueue
        {...props}
        detail={{ ...detail, current: { ...ticket, status: 'PENDING' }, waiting: [] }}
        message="Ticket 1 called."
      />,
    )
    expect(screen.getByRole('button', { name: 'Start service' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Start service' }))
    rerender(
      <OperatorQueue
        {...props}
        busy
        detail={{ ...detail, current: { ...ticket, status: 'OPERATING' }, waiting: [] }}
        message="Service started."
        pendingAction="start"
      />,
    )
    expect(screen.getByRole('button', { name: 'Complete service' })).toBeDisabled()

    rerender(
      <OperatorQueue
        {...props}
        detail={{ ...detail, current: { ...ticket, status: 'OPERATING' }, waiting: [] }}
        message="Service started."
      />,
    )
    expect(screen.getByRole('button', { name: 'Complete service' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Complete service' }))
    rerender(
      <OperatorQueue
        {...props}
        busy
        detail={{ ...detail, waiting: [] }}
        message="Service completed."
        pendingAction="complete"
      />,
    )
    rerender(
      <OperatorQueue {...props} detail={{ ...detail, waiting: [] }} message="Service completed." />,
    )
    expect(screen.getByText('No customers are waiting.')).toHaveFocus()
  })

  it('restores focus once the next action is enabled after a confirmed transition', async () => {
    const user = userEvent.setup()
    const props = {
      busy: false,
      refreshing: false,
      pendingAction: null,
      message: '',
      error: '',
      onAction: vi.fn(),
      onRefresh: vi.fn(),
    }
    const pendingDetail = { ...detail, current: { ...ticket, status: 'PENDING' }, waiting: [] }
    const { rerender } = render(<OperatorQueue {...props} detail={pendingDetail} />)

    await user.click(screen.getByRole('button', { name: 'Start service' }))
    rerender(
      <OperatorQueue
        {...props}
        busy
        detail={{ ...detail, current: { ...ticket, status: 'OPERATING' }, waiting: [] }}
        message="Service started."
        pendingAction="start"
      />,
    )
    expect(screen.getByRole('button', { name: 'Complete service' })).toBeDisabled()

    rerender(
      <OperatorQueue
        {...props}
        detail={{ ...detail, current: { ...ticket, status: 'OPERATING' }, waiting: [] }}
        message="Service started."
      />,
    )
    expect(screen.getByRole('button', { name: 'Complete service' })).toHaveFocus()
  })
})
