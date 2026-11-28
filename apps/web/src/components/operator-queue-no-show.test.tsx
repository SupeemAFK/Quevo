import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen, render as testingRender } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '@/client/api/schema'
import { applyOperatorTicketUpdate } from '@/lib/operator-queue'
import { OperatorQueue } from './operator-queue'

type Detail = components['schemas']['queue.OperatorQueueDetailResponse']

function renderQueue(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return testingRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

const ticket = {
  id: 'ticket-1',
  ticketNumber: '1',
  status: 'WAITING',
  businessDate: '2026-11-08',
  joinedAt: '2026-11-08T10:00:00Z',
  requestAnswers: {},
  requestLabels: {},
}
const detail: Detail = {
  queue: {
    branchId: 'branch',
    branchName: 'Branch',
    serviceId: 'service',
    queueId: 'queue',
    queueName: 'Main queue',
    serviceName: 'Service',
    businessDate: '2026-11-08',
    waitingCount: 1,
  },
  waiting: [ticket],
  recent: [],
}

const pendingDetail = { ...detail, current: { ...ticket, status: 'PENDING' }, waiting: [] }

// Issue #19 (F-013/FR-021): operator no-show UI is exposed only for eligible
// PENDING called tickets and confirms success or a recoverable failure.
describe('OperatorQueue no-show (issue #19)', () => {
  it('exposes Mark no-show only for a PENDING current ticket and calls onAction', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderQueue(
      <OperatorQueue
        detail={pendingDetail}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error=""
        onAction={onAction}
        onRefresh={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Mark no-show' }))
    expect(onAction).toHaveBeenCalledWith('no-show')
  })

  it('does not expose Mark no-show for OPERATING, WAITING, or no current ticket', () => {
    const { unmount } = renderQueue(
      <OperatorQueue
        detail={{ ...detail, current: { ...ticket, status: 'OPERATING' }, waiting: [] }}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Mark no-show' })).not.toBeInTheDocument()
    // OPERATING offers completion instead of no-show.
    expect(screen.getByRole('button', { name: 'Complete service' })).toBeInTheDocument()
    unmount()

    // A WAITING ticket in the waiting list is not a current called ticket.
    renderQueue(
      <OperatorQueue
        detail={{ ...detail }}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Mark no-show' })).not.toBeInTheDocument()
  })

  it('confirms success or shows a recoverable failure', () => {
    const { rerender } = renderQueue(
      <OperatorQueue
        detail={pendingDetail}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message="Ticket marked no-show."
        error=""
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Ticket marked no-show.')

    rerender(
      <OperatorQueue
        detail={pendingDetail}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error="Could not update ticket. Refresh the queue and try again."
        onAction={vi.fn()}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not update ticket. Refresh the queue and try again.',
    )
  })

  it('applyOperatorTicketUpdate clears current and records recent on no-show', () => {
    const noShow = { ...ticket, status: 'NO_SHOW' }
    const after = applyOperatorTicketUpdate(pendingDetail, noShow, 'no-show')
    expect(after?.current).toBeUndefined()
    expect(after?.recent[0]).toEqual(noShow)
  })
})
