import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from './login-form'

describe('LoginForm', () => {
  it('submits credentials and shows success', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockResolvedValue({
      id: 'customer-1',
      displayName: 'Demo Customer',
      role: 'CUSTOMER',
    })

    render(<LoginForm signIn={signIn} />)

    await user.type(screen.getByLabelText('Identifier'), 'customer@example.test')
    await user.type(screen.getByLabelText('Password'), 'local-demo-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signIn).toHaveBeenCalledWith({
      identifier: 'customer@example.test',
      password: 'local-demo-password',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Signed in successfully.')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('shows a generic error when credentials are rejected', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockRejectedValue(new Error('invalid_credentials'))

    render(<LoginForm signIn={signIn} />)

    await user.type(screen.getByLabelText('Identifier'), 'customer@example.test')
    await user.type(screen.getByLabelText('Password'), 'incorrect-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sign in failed. Check your identifier and password.',
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('invalid_credentials')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })
})
