import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeedbackMessage, LoadingMessage } from './feedback-message'

describe('FeedbackMessage', () => {
  it('announces success politely exactly once through its status role', () => {
    render(<FeedbackMessage kind="success">Ticket status updated.</FeedbackMessage>)

    const message = screen.getByRole('status')
    expect(message).toHaveTextContent('Ticket status updated.')
    expect(message).toHaveClass('border-border', 'text-foreground')
    expect(message).not.toHaveClass('border-status-success/50', 'text-status-success')
    expect(message.querySelector('svg')).toHaveClass('text-muted-foreground')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces errors assertively through their alert role', () => {
    render(<FeedbackMessage kind="error">Refresh the queue and try again.</FeedbackMessage>)

    expect(screen.getByRole('alert')).toHaveTextContent('Refresh the queue and try again.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('uses one polite status region for loading feedback', () => {
    render(<LoadingMessage>Loading your queue…</LoadingMessage>)

    expect(screen.getByRole('status')).toHaveTextContent('Loading your queue…')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
