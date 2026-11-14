import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setResponseHeader } from '@tanstack/react-start/server'
import { createApiClient } from './api-client'
import { SESSION_COOKIE_NAME } from './session'

type QueueInput = { branchId: string; serviceId: string }
type TicketAction = 'start' | 'complete' | 'skip'

function api() {
  const token = getCookie(SESSION_COOKIE_NAME)
  if (!token) throw new Error('Please sign in to continue.')
  const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
  return {
    client: createApiClient(`${baseUrl}/api/v1`),
    headers: { Authorization: `Bearer ${token}` },
  }
}

export const getOperatorQueues = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const { client, headers } = api()
  const { data, response } = await client.GET('/operator/queues', { headers })
  if (!response.ok || !data) throw new Error('Could not load your queues. Please try again.')
  return data.items
})

export const getOperatorQueue = createServerFn({ method: 'GET' })
  .validator((data: QueueInput) => data)
  .handler(async ({ data: path }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { client, headers } = api()
    const { data, response } = await client.GET(
      '/operator/branches/{branchId}/services/{serviceId}/tickets',
      {
        params: { path },
        headers,
      },
    )
    if (!response.ok || !data) throw new Error('Could not load this queue. Please try again.')
    return data
  })

export const callNext = createServerFn({ method: 'POST' })
  .validator((data: QueueInput) => data)
  .handler(async ({ data: path }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { client, headers } = api()
    const { data, response } = await client.POST(
      '/operator/branches/{branchId}/services/{serviceId}/tickets/call-next',
      {
        params: { path },
        headers,
      },
    )
    if (response.status === 204) return null
    if (response.status === 409)
      throw new Error('Finish your current ticket before calling another.')
    if (!response.ok || !data)
      throw new Error('Could not call the next ticket. Please refresh and try again.')
    return data
  })

export const updateOperatorTicket = createServerFn({ method: 'POST' })
  .validator((data: { ticketId: string; action: TicketAction }) => data)
  .handler(async ({ data: input }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { client, headers } = api()
    const options = { params: { path: { ticketId: input.ticketId } }, headers }
    const result =
      input.action === 'start'
        ? await client.POST('/operator/tickets/{ticketId}/start', options)
        : input.action === 'complete'
          ? await client.POST('/operator/tickets/{ticketId}/complete', options)
          : input.action === 'skip'
            ? await client.POST('/operator/tickets/{ticketId}/skip', options)
            : null
    if (!result) throw new Error('This action is not available.')
    if (result.response.status === 409)
      throw new Error('The ticket has changed. Refresh the queue and try again.')
    if (result.response.status === 404) throw new Error('This ticket is no longer assigned to you.')
    if (!result.response.ok || !result.data)
      throw new Error('Could not update the ticket. Please refresh and try again.')
    return result.data
  })

export const operatorQueuesOptions = (operatorID: string) =>
  queryOptions({
    queryKey: ['operator', operatorID, 'queues'],
    queryFn: () => getOperatorQueues(),
  })

export const operatorQueueOptions = (operatorID: string, branchId: string, serviceId: string) =>
  queryOptions({
    queryKey: ['operator', operatorID, 'queue', branchId, serviceId],
    queryFn: () => getOperatorQueue({ data: { branchId, serviceId } }),
    enabled: Boolean(branchId && serviceId),
  })
