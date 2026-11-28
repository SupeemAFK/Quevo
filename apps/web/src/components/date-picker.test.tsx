import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DatePicker } from './date-picker'

describe('DatePicker', () => {
  it('opens the calendar and returns a local YYYY-MM-DD value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker ariaLabel="Summary start date" onChange={onChange} value="2026-11-24" />)

    await user.click(screen.getByRole('button', { name: 'Summary start date: Nov 24, 2026' }))
    await user.click(await screen.findByRole('button', { name: /November 27/ }))

    expect(onChange).toHaveBeenCalledWith('2026-11-27')
  })
})
