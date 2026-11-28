import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setResponseHeader } from '@tanstack/react-start/server'
import type { components } from '@/client/api/schema'
import { createApiClient } from './api-client'
import { SESSION_COOKIE_NAME } from './session'

type QueueInput = { branchId: string; queueId: string }
type TicketAction = 'start' | 'complete' | 'skip' | 'no-show'
type OperatorQueueDetail = components['schemas']['queue.OperatorQueueDetailResponse']
type OperatorTicket = components['schemas']['queue.OperatorTicketResponse']
export type TicketHistory = {
  items: {
    id: string
    fromStatus?: string
    toStatus: string
    actorName?: string
    occurredAt: string
  }[]
  limit: number
  offset: number
  total: number
}

export function applyOperatorTicketUpdate(
  detail: OperatorQueueDetail | undefined,
  ticket: OperatorTicket | null,
  action: 'call-next' | TicketAction,
): OperatorQueueDetail | undefined {
  if (!detail || !ticket) return detail

  if (action === 'call-next') {
    return {
      ...detail,
      waiting: detail.waiting.filter((waiting) => waiting.id !== ticket.id),
      current: ticket,
      queue: {
        ...detail.queue,
        waitingCount: Math.max(0, (detail.queue.waitingCount ?? detail.waiting.length) - 1),
      },
    }
  }

  if (ticket.status === 'COMPLETED' || ticket.status === 'SKIPPED' || ticket.status === 'NO_SHOW') {
    return {
      ...detail,
      current: undefined,
      recent: [ticket, ...detail.recent.filter((recent) => recent.id !== ticket.id)].slice(0, 10),
    }
  }

  return { ...detail, current: ticket }
}
type HandoffInput = { ticketId: string; recipientOperatorId: string }

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
    const { headers } = api()
    const base = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
    const response = await fetch(
      `${base}/api/v1/operator/branches/${encodeURIComponent(path.branchId)}/queues/${encodeURIComponent(path.queueId)}/tickets`,
      { headers, cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Could not load this queue. Please try again.')
    return (await response.json()) as components['schemas']['queue.OperatorQueueDetailResponse']
  })

export const callNext = createServerFn({ method: 'POST' })
  .validator((data: QueueInput) => data)
  .handler(async ({ data: path }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { headers } = api()
    const base = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
    const response = await fetch(
      `${base}/api/v1/operator/branches/${encodeURIComponent(path.branchId)}/queues/${encodeURIComponent(path.queueId)}/tickets/call-next`,
      { method: 'POST', headers, cache: 'no-store' },
    )
    if (response.status === 204) return null
    if (response.status === 409)
      throw new Error('Finish your current ticket before calling another.')
    if (!response.ok)
      throw new Error('Could not call the next ticket. Please refresh and try again.')
    return (await response.json()) as components['schemas']['queue.OperatorTicketResponse']
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
            : input.action === 'no-show'
              ? await client.POST('/operator/tickets/{ticketId}/no-show', options)
              : null
    if (!result) throw new Error('This action is not available.')
    if (result.response.status === 409)
      throw new Error('The ticket has changed. Refresh the queue and try again.')
    if (result.response.status === 404) throw new Error('This ticket is no longer assigned to you.')
    if (!result.response.ok || !result.data)
      throw new Error('Could not update the ticket. Please refresh and try again.')
    return result.data
  })

export const getHandoffCandidates = createServerFn({ method: 'GET' })
  .validator((data: { ticketId: string }) => data)
  .handler(async ({ data: input }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { client, headers } = api()
    const { data, response } = await client.GET('/operator/tickets/{ticketId}/handoff-options', {
      params: { path: input },
      headers,
    })
    if (response.status === 404) throw new Error('This ticket is no longer assigned to you.')
    if (response.status === 409) throw new Error('This ticket can no longer be transferred.')
    if (!response.ok || !data)
      throw new Error('Could not load available operators. Please try again.')
    return data.items
  })

export const handoffOperatorTicket = createServerFn({ method: 'POST' })
  .validator((data: HandoffInput) => data)
  .handler(async ({ data: input }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { client, headers } = api()
    const { data, response } = await client.POST('/operator/tickets/{ticketId}/handoff', {
      params: { path: { ticketId: input.ticketId } },
      body: { recipientOperatorId: input.recipientOperatorId },
      headers,
    })
    if (response.status === 404) throw new Error('This ticket is no longer assigned to you.')
    if (response.status === 409)
      throw new Error('The ticket or recipient is no longer eligible. Refresh and choose again.')
    if (!response.ok || !data) throw new Error('Could not transfer the ticket. Please try again.')
    return data
  })

export const operatorQueuesOptions = (operatorID: string) =>
  queryOptions({
    queryKey: ['operator', operatorID, 'queues'],
    queryFn: () => getOperatorQueues(),
  })

export const operatorQueueOptions = (operatorID: string, branchId: string, queueId: string) =>
  queryOptions({
    queryKey: ['operator', operatorID, 'queue', branchId, queueId],
    queryFn: () => getOperatorQueue({ data: { branchId, queueId } }),
    enabled: Boolean(branchId && queueId),
  })

export const getOperatorTicketHistory = createServerFn({ method: 'GET' })
  .validator((data: { ticketId: string; limit: number; offset: number }) => data)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { headers } = api()
    const base = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
    const params = new URLSearchParams({ limit: String(data.limit), offset: String(data.offset) })
    const response = await fetch(
      `${base}/api/v1/operator/tickets/${encodeURIComponent(data.ticketId)}/history?${params}`,
      { headers, cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Could not load ticket history.')
    return (await response.json()) as TicketHistory
  })

export const handoffCandidatesOptions = (operatorID: string, ticketId: string) =>
  queryOptions({
    queryKey: ['operator', operatorID, 'handoff-candidates', ticketId],
    queryFn: () => getHandoffCandidates({ data: { ticketId } }),
    enabled: Boolean(ticketId),
  })
