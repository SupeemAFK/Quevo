import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '@/client/api/schema'
import { CustomerServiceSelection } from './customer-service-selection'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    children: ReactNode
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to.replace('$ticketId', params?.ticketId ?? '')} {...props}>
      {children}
    </a>
  ),
}))

type Service = components['schemas']['queue.ServiceResponse']
type ActiveTicket = components['schemas']['queue.TicketResponse']

const generalService: Service = {
  id: 'service-1',
  branchId: 'branch-1',
  branchName: 'Demo Branch',
  name: 'General Service',
  queues: [{ id: 'queue-1', name: 'Main queue' }],
  fields: [],
}

const passportService: Service = {
  id: 'service-2',
  branchId: 'branch-2',
  branchName: 'City Branch',
  name: 'Passport Service',
  queues: [{ id: 'queue-2', name: 'Main queue' }],
  fields: [],
}

const activeTicket: ActiveTicket = {
  id: 'ticket-1',
  branchId: 'branch-1',
  branchName: 'Demo Branch',
  businessDate: '2026-11-23',
  joinedAt: '2026-11-23T10:00:00Z',
  queueId: 'queue-1',
  queueName: 'Main queue',
  requestAnswers: {},
  requestLabels: {},
  serviceId: 'service-1',
  serviceName: 'General Service',
  status: 'WAITING',
  ticketNumber: '12',
}

const previousDayTicket: ActiveTicket = {
  ...activeTicket,
  businessDate: '2026-11-22',
  joinedAt: '2026-11-22T10:00:00Z',
}

describe('CustomerServiceSelection', () => {
  it('preselects the only service and lets the customer join without an extra selection', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={[generalService]}
      />,
    )

    expect(screen.getByText('General Service')).toBeInTheDocument()
    expect(screen.getByText('Demo Branch')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join queue' })).toBeEnabled()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Join queue' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onJoin).toHaveBeenCalledWith(generalService, 'queue-1', {}, [])
  })

  it('offers multiple services as keyboard-operable radio choices', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={[generalService, passportService]}
      />,
    )

    const general = screen.getByRole('radio', { name: /General Service.*Demo Branch/ })
    const passport = screen.getByRole('radio', { name: /Passport Service.*City Branch/ })
    expect(general).not.toBeChecked()
    expect(passport).not.toBeChecked()
    await user.click(passport)
    expect(passport).toBeChecked()
    expect(screen.getByRole('button', { name: 'Join queue' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Join queue' }))

    expect(onJoin).toHaveBeenCalledWith(passportService, 'queue-2', {}, [])
  })

  it('collects the configured queue and service-specific answer before joining', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    const bankService: Service = {
      ...generalService,
      queues: [{ id: 'account-queue', name: 'Account opening' }],
      allowsUploads: true,
      requiresDocuments: true,
      documentGuidance: 'Bring proof of address and photo ID.',
      fields: [
        {
          id: 'request-type',
          position: 1,
          type: 'single_select',
          label: 'Account type',
          required: true,
          options: ['Everyday', 'Savings'],
        },
      ],
    }
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={[bankService]}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: /Account type/ }))
    await user.click(await screen.findByRole('option', { name: 'Savings' }))
    const document = new File(['photo'], 'proof.png', { type: 'image/png' })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:proof'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    await user.upload(screen.getByLabelText('Upload files'), document)
    expect(await screen.findByAltText('Preview of proof.png')).toHaveAttribute('src', 'blob:proof')
    await user.click(screen.getByRole('button', { name: 'Join queue' }))
    expect(onJoin).toHaveBeenCalledWith(
      bankService,
      'account-queue',
      { 'request-type': 'Savings' },
      [document],
    )
    expect(screen.getByText('Bring proof of address and photo ID.')).toBeInTheDocument()
    expect(screen.getByText(/uploaded to your ticket as soon as it is created/)).toBeInTheDocument()
  })

  it('requires configured form answers before joining', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    const requiredService: Service = {
      ...generalService,
      fields: [
        {
          id: 'request-type',
          position: 1,
          type: 'single_select',
          label: 'Account type',
          required: true,
          options: ['Everyday', 'Savings'],
        },
      ],
    }
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={[requiredService]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Join queue' }))
    expect(onJoin).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Account type is required.')
  })

  it('renders and validates a labeled text field through the shared form controls', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    const textService: Service = {
      ...generalService,
      fields: [
        {
          id: 'preferred-name',
          position: 1,
          type: 'short_text',
          label: 'Name to call you',
          required: true,
          options: [],
        },
      ],
    }
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={[textService]}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Name to call you, required' }), 'Sam')
    await user.click(screen.getByRole('button', { name: 'Join queue' }))
    expect(onJoin).toHaveBeenCalledWith(textService, 'queue-1', { 'preferred-name': 'Sam' }, [])
  })

  it('requires a supporting file before joining a document-required service', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    const documentService: Service = {
      ...generalService,
      allowsUploads: true,
      requiresDocuments: true,
      documentGuidance: 'Bring proof of address.',
    }
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={[documentService]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Join queue' }))
    expect(onJoin).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Add at least one required document before joining.',
    )
  })

  it('explains that a service must be chosen before the join action is available', () => {
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={vi.fn()}
        services={[generalService, passportService]}
      />,
    )

    expect(
      screen.getByText(
        'Choose an available service to see its request form and document requirements.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join queue' })).toBeDisabled()
  })

  it('shows a useful empty state when no active service is available', () => {
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={vi.fn()}
        services={[]}
      />,
    )

    expect(
      screen.getByText('No active services are available right now. Check again later.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join queue' })).toBeDisabled()
  })

  it('shows the active ticket and blocks joining another service', () => {
    render(
      <CustomerServiceSelection
        activeTickets={[activeTicket]}
        error=""
        joining={false}
        onJoin={vi.fn()}
        services={[generalService, passportService]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Your active ticket' })).toBeInTheDocument()
    expect(screen.getByText('12', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Waiting', { exact: true })).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'View ticket 12 (General Service at Demo Branch). Status: Waiting',
      }),
    ).toHaveAttribute('href', '/tickets/ticket-1')
    expect(
      screen.getByText(
        'You can hold one active ticket at a time. Finish or cancel it before joining another service.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join queue' })).not.toBeInTheDocument()
  })

  it('blocks joining when any active ticket exists, including one from another day', () => {
    render(
      <CustomerServiceSelection
        activeTickets={[previousDayTicket]}
        error=""
        joining={false}
        onJoin={vi.fn()}
        services={[generalService]}
      />,
    )

    expect(screen.getByRole('link', { name: /View ticket 12/ })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Your active ticket' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join queue' })).not.toBeInTheDocument()
  })

  it('guards against rapid duplicate join events before the pending state rerenders', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining={false}
        onJoin={onJoin}
        services={[generalService]}
      />,
    )

    await user.dblClick(screen.getByRole('button', { name: 'Join queue' }))

    expect(onJoin).toHaveBeenCalledOnce()
  })

  it('shows an API duplicate-join error while retaining the active ticket link', () => {
    render(
      <CustomerServiceSelection
        activeTickets={[activeTicket]}
        error="You already have an active ticket. Finish or cancel it before joining another service."
        joining={false}
        onJoin={vi.fn()}
        services={[generalService]}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You already have an active ticket. Finish or cancel it before joining another service.',
    )
    expect(screen.getByRole('link', { name: /View ticket 12/ })).toBeInTheDocument()
  })

  it('communicates pending work and disables controls against a second submission', () => {
    const onJoin = vi.fn()
    render(
      <CustomerServiceSelection
        activeTickets={[]}
        error=""
        joining
        onJoin={onJoin}
        services={[generalService]}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Joining queue…')
    expect(screen.getByRole('button', { name: 'Joining queue…' })).toBeDisabled()
    expect(onJoin).not.toHaveBeenCalled()
  })
})
