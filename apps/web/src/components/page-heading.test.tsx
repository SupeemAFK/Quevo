import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeading } from './page-heading'

describe('PageHeading', () => {
  it('makes the page title a programmatic focus target', () => {
    render(<PageHeading>Customer queue</PageHeading>)

    expect(screen.getByRole('heading', { name: 'Customer queue' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })
})
