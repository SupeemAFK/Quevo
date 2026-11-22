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

    const select = screen.getByRole('combobox', { name: 'Color theme' })
    expect(select).toHaveValue('system')
    await user.selectOptions(select, 'dark')
    expect(select).toHaveValue('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem('quevo-theme')).toBe('dark')

    await user.selectOptions(select, 'light')
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

    expect(await screen.findByRole('combobox', { name: 'Color theme' })).toHaveValue('dark')
    expect(document.documentElement).toHaveClass('dark')
  })
})
