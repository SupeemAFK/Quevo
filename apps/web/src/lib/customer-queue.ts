import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setResponseHeader } from '@tanstack/react-start/server'
import { createApiClient } from './api-client'
import { SESSION_COOKIE_NAME } from './session'

type JoinQueueInput = {
  branchId: string
  serviceId: string
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

export const joinQueue = createServerFn({ method: 'POST' })
  .validator((data: JoinQueueInput) => data)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { data: ticket, response } = await createApiClient(`${apiBaseUrl()}/api/v1`).POST(
      '/branches/{branchId}/services/{serviceId}/tickets',
      {
        params: { path: data },
        headers: { Authorization: `Bearer ${sessionToken()}` },
      },
    )

    if (response.status === 409) {
      throw new Error('You already have an active ticket for this service today.')
    }
    if (response.status === 404) throw new Error('This service is no longer available.')
    if (!response.ok || !ticket) throw new Error('Could not join the queue. Please try again.')
    return ticket
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

export const availableServicesOptions = queryOptions({
  queryKey: ['customer', 'services'],
  queryFn: () => getAvailableServices(),
  staleTime: 30_000,
})

export const customerTicketOptions = (ticketId: string) =>
  queryOptions({
    queryKey: ['customer', 'tickets', ticketId],
    queryFn: () => getCustomerTicket({ data: ticketId }),
  })
