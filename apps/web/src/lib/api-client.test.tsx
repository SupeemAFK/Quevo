import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiHealthStatus } from '@/components/api-health-status'
import { getApiHealth } from './api-client'

describe('typed API component integration', () => {
  it('renders the health response returned by the API client', async () => {
    const health = await getApiHealth('http://127.0.0.1:8080/api/v1')

    render(<ApiHealthStatus health={health} />)

    expect(await screen.findByRole('status')).toHaveTextContent('API status: healthy')
  })
})
