import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiHealthStatus } from './api-health-status'

describe('ApiHealthStatus', () => {
  it('shows the API status', () => {
    render(<ApiHealthStatus health={{ status: 'healthy' }} />)

    expect(screen.getByRole('status')).toHaveTextContent('API status: healthy')
  })
})
