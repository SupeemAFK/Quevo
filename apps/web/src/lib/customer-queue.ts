import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setResponseHeader } from '@tanstack/react-start/server'
import type { components } from '@/client/api/schema'
import { createApiClient } from './api-client'
import { SESSION_COOKIE_NAME } from './session'

type Ticket = components['schemas']['queue.TicketResponse']

type JoinQueueInput = {
  branchId: string
  queueId: string
  serviceId: string
  requestAnswers: Record<string, string>
}

function apiBaseUrl() {
  return (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
}

function sessionToken() {
  const token = getCookie(SESSION_COOKIE_NAME)
  if (!token) throw new Error('Please sign in to continue.')
  return token
}

export const getAvailableServices = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const { data, response } = await createApiClient(`${apiBaseUrl()}/api/v1`).GET('/services', {
    headers: { Authorization: `Bearer ${sessionToken()}` },
  })

  if (!response.ok || !data) throw new Error('Could not load services. Please try again.')
  return data.items
})

export const getActiveCustomerTickets = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const { data, response } = await createApiClient(`${apiBaseUrl()}/api/v1`).GET(
    '/tickets/active',
    {
      headers: { Authorization: `Bearer ${sessionToken()}` },
    },
  )

  if (!response.ok || !data)
    throw new Error('Could not load your active tickets. Please try again.')
  return data.items
})

export const joinQueue = createServerFn({ method: 'POST' })
  .validator((data: JoinQueueInput) => data)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const response = await fetch(
      `${apiBaseUrl()}/api/v1/branches/${encodeURIComponent(data.branchId)}/queues/${encodeURIComponent(data.queueId)}/tickets`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${sessionToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestAnswers: data.requestAnswers }),
      },
    )

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string
        requestId?: string
      } | null
      const serverMessage = payload?.message?.trim()

      if (response.status === 409) {
        throw new Error(
          serverMessage || 'You already have an active ticket for this service today.',
        )
      }
      if (response.status === 404) {
        throw new Error(serverMessage || 'This service is no longer available.')
      }
      if (response.status === 400) {
        throw new Error(serverMessage || 'Check the required service details and try again.')
      }
      if (response.status === 403) {
        throw new Error(serverMessage || 'You do not have permission to join this queue.')
      }
      if (response.status >= 500) {
        const reference = payload?.requestId ? ` Reference: ${payload.requestId}.` : ''
        throw new Error(`The queue could not be joined right now. Please try again.${reference}`)
      }
      throw new Error(serverMessage || 'Could not join the queue. Please try again.')
    }
    return (await response.json()) as Ticket
  })

export const cancelCustomerTicket = createServerFn({ method: 'POST' })
  .validator((ticketId: string) => ticketId)
  .handler(async ({ data: ticketId }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const response = await fetch(
      `${apiBaseUrl()}/api/v1/tickets/${encodeURIComponent(ticketId)}/cancel`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${sessionToken()}` },
      },
    )
    if (response.status === 409)
      throw new Error('This ticket has already been called and can’t be cancelled.')
    if (!response.ok) throw new Error('Could not cancel this ticket. Please refresh and try again.')
    return (await response.json()) as Ticket
  })

export const getCustomerTicket = createServerFn({ method: 'GET' })
  .validator((ticketId: string) => ticketId)
  .handler(async ({ data: ticketId }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { data, response } = await createApiClient(`${apiBaseUrl()}/api/v1`).GET(
      '/tickets/{ticketId}',
      {
        params: { path: { ticketId } },
        headers: { Authorization: `Bearer ${sessionToken()}` },
      },
    )

    if (response.status === 404) throw new Error('The ticket could not be found.')
    if (!response.ok || !data) throw new Error('Could not load your ticket. Please try again.')
    return data
  })

export const customerQueueOptions = (customerID: string) =>
  queryOptions({
    queryKey: ['customer', customerID, 'queue'],
    queryFn: async () => {
      const [services, activeTickets] = await Promise.all([
        getAvailableServices(),
        getActiveCustomerTickets(),
      ])
      return { services, activeTickets }
    },
  })

export const customerTicketOptions = (customerID: string, ticketId: string) =>
  queryOptions({
    queryKey: ['customer', customerID, 'tickets', ticketId],
    queryFn: () => getCustomerTicket({ data: ticketId }),
  })
