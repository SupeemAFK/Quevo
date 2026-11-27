import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '@/client/api/schema'
import { OperatorQueue } from './operator-queue'

const serverFns = vi.hoisted(() => ({
  getTargets: vi.fn(),
  handoff: vi.fn(),
}))

vi.mock('@/lib/operator-queue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/operator-queue')>()
  return {
    ...actual,
    getOperatorTicketHandoffTargets: serverFns.getTargets,
    handoffOperatorTicket: serverFns.handoff,
  }
})

type Detail = components['schemas']['queue.OperatorQueueDetailResponse']

const detail: Detail = {
  queue: {
    branchId: 'branch-1',
    branchName: 'Main branch',
    serviceId: 'service-1',
    queueId: 'queue-1',
    queueName: 'General queue',
    serviceName: 'General service',
    businessDate: '2026-11-28',
  },
  waiting: [],
  recent: [],
  current: {
    id: 'ticket-1',
    ticketNumber: 'A101',
    status: 'PENDING',
    businessDate: '2026-11-28',
    joinedAt: '2026-11-28T10:00:00Z',
    requestAnswers: {},
    requestLabels: {},
  },
}

function renderQueue(onHandoff = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OperatorQueue
        detail={detail}
        busy={false}
        refreshing={false}
        pendingAction={null}
        message=""
        error=""
        operatorId="operator-current"
        onAction={vi.fn()}
        onRefresh={vi.fn()}
        onHandoff={onHandoff}
      />
    </QueryClientProvider>,
  )
}

describe('operator ticket handoff', () => {
  it('shows eligible operators and submits the selected recipient', async () => {
    const user = userEvent.setup()
    const onHandoff = vi.fn()
    serverFns.getTargets.mockResolvedValueOnce([
      { id: 'operator-next', displayName: 'Jordan Lee' },
      { id: 'operator-backup', displayName: 'Taylor Chen' },
    ])
    serverFns.handoff.mockResolvedValueOnce(detail.current)
    renderQueue(onHandoff)

    await user.click(screen.getByRole('button', { name: 'Hand off ticket' }))
    await user.click(await screen.findByRole('combobox', { name: 'Operator' }))
    await user.click(await screen.findByRole('option', { name: 'Jordan Lee' }))
    await user.click(screen.getByRole('button', { name: 'Confirm handoff' }))

    expect(serverFns.handoff).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', operatorId: 'operator-next' },
    })
    expect(onHandoff).toHaveBeenCalledOnce()
  })

  it('explains when no other authorized operator is available', async () => {
    const user = userEvent.setup()
    serverFns.getTargets.mockResolvedValueOnce([])
    renderQueue()

    await user.click(screen.getByRole('button', { name: 'Hand off ticket' }))
    expect(
      await screen.findByText('No other authorized operator is available right now.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm handoff' })).not.toBeInTheDocument()
  })
})
