import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '@/client/api/schema'
import { OperatorServiceNavigation } from './operator-service-navigation'

type QueueOption = components['schemas']['queue.OperatorQueueResponse']

const generalQueue: QueueOption = {
  branchId: 'branch-1',
  branchName: 'Demo Branch',
  serviceId: 'service-1',
  serviceName: 'General Service',
  businessDate: '2026-11-22',
  waitingCount: 1,
}

const passportQueue: QueueOption = {
  branchId: 'branch-2',
  branchName: 'City Branch',
  serviceId: 'service-2',
  serviceName: 'Passport Service',
  businessDate: '2026-11-22',
  waitingCount: 0,
}

describe('OperatorServiceNavigation', () => {
  it('provides a compact mobile selector and desktop service navigation', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <OperatorServiceNavigation
        onSelect={onSelect}
        queues={[generalQueue, passportQueue]}
        selectedQueueKey="branch-1:service-1"
      />,
    )

    const navigation = screen.getByRole('navigation', { name: 'Assigned queues' })
    expect(navigation).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /General Service.*Demo Branch/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Passport Service.*City Branch/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    const mobileSelector = screen.getByRole('combobox', { name: 'Service' })
    expect(mobileSelector).toHaveClass('min-h-11')
    await user.selectOptions(mobileSelector, 'branch-2:service-2')

    expect(onSelect).toHaveBeenCalledWith(passportQueue)
  })

  it('omits service selection for a single assigned queue', () => {
    const { container } = render(
      <OperatorServiceNavigation
        onSelect={vi.fn()}
        queues={[generalQueue]}
        selectedQueueKey="branch-1:service-1"
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
