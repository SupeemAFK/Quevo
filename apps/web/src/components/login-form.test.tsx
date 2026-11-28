import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from './login-form'

describe('LoginForm', () => {
  it('supports keyboard-only credential entry and submission in tab order', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockResolvedValue({
      id: 'customer-1',
      displayName: 'Demo Customer',
      role: 'CUSTOMER',
    })
    render(<LoginForm signIn={signIn} />)

    await user.tab()
    expect(screen.getByLabelText('Email')).toHaveFocus()
    await user.type(screen.getByLabelText('Email'), 'customer@example.test')
    await user.tab()
    expect(screen.getByLabelText('Password')).toHaveFocus()
    await user.type(screen.getByLabelText('Password'), 'local-demo-password')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(signIn).toHaveBeenCalledWith({
      email: 'customer@example.test',
      password: 'local-demo-password',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Signed in successfully.')
  })

  it('submits credentials and shows success', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockResolvedValue({
      id: 'customer-1',
      displayName: 'Demo Customer',
      role: 'CUSTOMER',
    })

    render(<LoginForm signIn={signIn} />)

    await user.type(screen.getByLabelText('Email'), 'customer@example.test')
    await user.type(screen.getByLabelText('Password'), 'local-demo-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signIn).toHaveBeenCalledWith({
      email: 'customer@example.test',
      password: 'local-demo-password',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Signed in successfully.')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('shows a generic error when credentials are rejected', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockRejectedValue(new Error('invalid_credentials'))

    render(<LoginForm signIn={signIn} />)

    await user.type(screen.getByLabelText('Email'), 'customer@example.test')
    await user.type(screen.getByLabelText('Password'), 'incorrect-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign in failed. Check your email and password.',
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('invalid_credentials')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('blocks sign-in when the email field is empty', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockResolvedValue({
      id: 'customer-1',
      displayName: 'Demo Customer',
      role: 'CUSTOMER',
    })

    render(<LoginForm signIn={signIn} />)

    await user.type(screen.getByLabelText('Password'), 'local-demo-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signIn).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Email')).toBeRequired()
    expect(screen.getByLabelText('Email')).toBeInvalid()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces sign-in progress while disabling another submission', async () => {
    const user = userEvent.setup()
    let finishSignIn = () => {}
    const signIn = vi.fn(
      () =>
        new Promise<{
          id: string
          displayName: string
          role: 'CUSTOMER'
        }>((resolve) => {
          finishSignIn = () =>
            resolve({ id: 'customer-1', displayName: 'Demo Customer', role: 'CUSTOMER' })
        }),
    )

    render(<LoginForm signIn={signIn} />)

    await user.type(screen.getByLabelText('Email'), 'customer@example.test')
    await user.type(screen.getByLabelText('Password'), 'local-demo-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('status')).toHaveTextContent('Signing in…')
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('aria-disabled', 'true')
    finishSignIn()
    await screen.findByText('Signed in successfully.')
    expect(screen.getByRole('status')).toHaveTextContent('Signed in successfully.')
  })
})
