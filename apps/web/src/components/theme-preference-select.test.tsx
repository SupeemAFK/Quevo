import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemePreferenceSelect } from './theme-preference-select'
import { ThemeProvider } from './theme-provider'

describe('ThemePreferenceSelect', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('starts in system mode and persists a selected theme', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemePreferenceSelect />
      </ThemeProvider>,
    )

    const systemButton = screen.getByRole('button', { name: 'Use system theme' })
    const lightButton = screen.getByRole('button', { name: 'Use light theme' })
    const darkButton = screen.getByRole('button', { name: 'Use dark theme' })
    expect(systemButton).toHaveAttribute('aria-pressed', 'true')
    await user.click(darkButton)
    expect(darkButton).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem('quevo-theme')).toBe('dark')

    await user.click(lightButton)
    expect(lightButton).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(window.localStorage.getItem('quevo-theme')).toBe('light')
  })

  it('restores a saved preference when it mounts', async () => {
    window.localStorage.setItem('quevo-theme', 'dark')
    render(
      <ThemeProvider>
        <ThemePreferenceSelect />
      </ThemeProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Use dark theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(document.documentElement).toHaveClass('dark')
  })
})
