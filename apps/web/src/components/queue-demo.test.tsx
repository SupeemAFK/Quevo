import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { QueueDemo } from './queue-demo'

describe('QueueDemo', () => {
  it('calls the oldest waiting ticket, marks it served, and resets the example', async () => {
    const user = userEvent.setup()
    render(<QueueDemo />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Demo ready. Three sample tickets are waiting.',
    )
    const current = screen.getByRole('region', { name: 'Current ticket' })
    const waiting = screen.getByRole('list', { name: 'Sample tickets waiting' })
    expect(
      within(waiting)
        .getAllByRole('listitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual([
      expect.stringContaining('A101'),
      expect.stringContaining('A102'),
      expect.stringContaining('A103'),
    ])

    await user.click(screen.getByRole('button', { name: 'Call next' }))
    expect(within(current).getByText('A101')).toBeInTheDocument()
    expect(within(current).getByText('Called')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ticket A101 is now called.')
    expect(screen.getByRole('button', { name: 'Call next' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Mark served' }))
    expect(screen.getByRole('region', { name: 'Served in this demo' })).toHaveTextContent(
      'A101Served',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Ticket A101 is marked served.')
    await user.click(screen.getByRole('button', { name: 'Call next' }))
    expect(await within(current).findByText('A102')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset demo' }))
    await waitFor(() => expect(within(waiting).getAllByRole('listitem')).toHaveLength(3))
    expect(
      within(waiting)
        .getAllByRole('listitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual([
      expect.stringContaining('A101'),
      expect.stringContaining('A102'),
      expect.stringContaining('A103'),
    ])
    expect(screen.queryByRole('region', { name: 'Served in this demo' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Demo reset. Three sample tickets are waiting.',
    )
  })

  it('disables calling and serving once the sample queue is empty', async () => {
    const user = userEvent.setup()
    render(<QueueDemo />)

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Call next' }))
      await user.click(screen.getByRole('button', { name: 'Mark served' }))
    }

    expect(screen.getByText('No sample tickets are waiting.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Call next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark served' })).toBeDisabled()
  })

  it('shows the customer ticket progress as the operator moves the queue', async () => {
    const user = userEvent.setup()
    render(<QueueDemo />)

    await user.click(screen.getByRole('button', { name: 'Call next' }))
    await user.click(screen.getByRole('button', { name: 'Mark served' }))
    await user.click(screen.getByRole('button', { name: 'Call next' }))
    await user.click(screen.getByRole('button', { name: 'Customer' }))

    const customerTicket = await screen.findByRole('region', { name: 'Your ticket' })
    expect(within(customerTicket).getByText('A102')).toBeInTheDocument()
    expect(within(customerTicket).getByText('In service')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'See the operator view' }))
    await user.click(await screen.findByRole('button', { name: 'Mark served' }))
    await user.click(screen.getByRole('button', { name: 'Customer' }))

    expect(
      within(await screen.findByRole('region', { name: 'Your ticket' })).getByText('Completed'),
    ).toBeInTheDocument()
  })
})
