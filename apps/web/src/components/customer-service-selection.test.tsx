import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomerServiceSelection } from './customer-service-selection'

describe('CustomerServiceSelection', () => {
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
      <CustomerServiceSelection error="" joining={false} onJoin={onJoin} services={services} />,
    )

    await user.click(screen.getByRole('button', { name: 'Join queue' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select a service before joining the queue.',
    )
    expect(onJoin).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'General Service at Demo Branch' }))
    await user.click(screen.getByRole('button', { name: 'Join queue' }))

    expect(onJoin).toHaveBeenCalledWith(services[0])
  })

  it('shows a clear empty state when no active service is available', () => {
    render(<CustomerServiceSelection error="" joining={false} onJoin={vi.fn()} services={[]} />)

    expect(screen.getByText('No active services are available right now.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join queue' })).toBeDisabled()
  })
})
