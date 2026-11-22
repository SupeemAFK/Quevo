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
    ).toEqual(['A101Waiting', 'A102Waiting', 'A103Waiting'])

    await user.click(screen.getByRole('button', { name: 'Call next' }))
    expect(within(current).getByText('A101')).toBeInTheDocument()
    expect(within(current).getByText('Called')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ticket A101 is now called.')
    expect(screen.getByRole('button', { name: 'Call next' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Mark served' }))
    expect(screen.getByText('A101 · Served')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ticket A101 is marked served.')
    await user.click(screen.getByRole('button', { name: 'Call next' }))
    expect(within(current).getByText('A102')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset demo' }))
    await waitFor(() => expect(within(waiting).getAllByRole('listitem')).toHaveLength(3))
    expect(
      within(waiting)
        .getAllByRole('listitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['A101Waiting', 'A102Waiting', 'A103Waiting'])
    expect(screen.queryByText('A101 · Served')).not.toBeInTheDocument()
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
})
