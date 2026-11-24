import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setResponseHeader } from '@tanstack/react-start/server'
import { SESSION_COOKIE_NAME } from './session'

export type Branch = { id: string; name: string }
export type ManagerQueue = { id: string; name: string; active: boolean }
export type FormField = {
  id?: string
  position?: number
  type: 'single_select' | 'short_text' | 'long_text'
  label: string
  required: boolean
  options: string[]
}
export type ManagerService = {
  id: string
  name: string
  active: boolean
  allowsUploads: boolean
  requiresDocuments: boolean
  documentGuidance: string
  queues: ManagerQueue[]
  fields: FormField[]
}
export type ManagerOperator = { id: string; name: string }
export type ManagerCounter = {
  id: string
  name: string
  active: boolean
  queueIds: string[]
  operators: ManagerOperator[]
}
export type ManagerCatalog = {
  branch: Branch
  services: ManagerService[]
  counters: ManagerCounter[]
  operators: ManagerOperator[]
}
export type ServiceSummary = {
  completed: number
  skipped: number
  cancelled: number
  noShow: number
  averageWaitSeconds: number | null
  averageServiceSeconds: number | null
}

function pathID(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('A valid branch, service, queue, or counter ID is required.')
  }
  return encodeURIComponent(value)
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getCookie(SESSION_COOKIE_NAME)
  if (!token) throw new Error('Please sign in to continue.')
  const base = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
  setResponseHeader('Cache-Control', 'private, no-store')
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204) return undefined as T
  if (!response.ok) {
    if (response.status === 403) throw new Error('You are not assigned to this branch.')
    if (response.status === 404) throw new Error('This branch item is no longer available.')
    if (response.status === 409)
      throw new Error('This change conflicts with current queue activity.')
    if (response.status === 400) throw new Error('Check the information and try again.')
    throw new Error('Could not complete this branch change. Please try again.')
  }
  const payload = await response.text()
  if (!payload) return undefined as T
  return JSON.parse(payload) as T
}

export const getManagedBranches = createServerFn({ method: 'GET' }).handler(() =>
  request<{ items: Branch[] }>('/manager/branches').then((result) => result.items),
)

export const getManagerCatalog = createServerFn({ method: 'GET' })
  .validator((branchId: string) => branchId)
  .handler(({ data }) => request<ManagerCatalog>(`/manager/branches/${pathID(data)}/catalog`))

export const createManagerService = createServerFn({ method: 'POST' })
  .validator((data: { branchId: string; name: string }) => data)
  .handler(({ data }) =>
    request<ManagerService>(`/manager/branches/${pathID(data.branchId)}/services`, 'POST', {
      name: data.name,
    }),
  )

export const updateManagerService = createServerFn({ method: 'POST' })
  .validator((data: { branchId: string; serviceId: string; name: string; active: boolean }) => data)
  .handler(({ data }) =>
    request<void>(
      `/manager/branches/${pathID(data.branchId)}/services/${pathID(data.serviceId)}`,
      'PATCH',
      { name: data.name, active: data.active },
    ),
  )

export const createManagerQueue = createServerFn({ method: 'POST' })
  .validator((data: { branchId: string; serviceId: string; name: string }) => data)
  .handler(({ data }) =>
    request<void>(
      `/manager/branches/${pathID(data.branchId)}/services/${pathID(data.serviceId)}/queues`,
      'POST',
      { name: data.name },
    ),
  )

export const updateManagerQueue = createServerFn({ method: 'POST' })
  .validator((data: { branchId: string; queueId: string; name: string; active: boolean }) => data)
  .handler(({ data }) =>
    request<void>(
      `/manager/branches/${pathID(data.branchId)}/queues/${pathID(data.queueId)}`,
      'PATCH',
      { name: data.name, active: data.active },
    ),
  )

export const saveManagerForm = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      branchId: string
      serviceId: string
      allowsUploads: boolean
      requiresDocuments: boolean
      documentGuidance: string
      fields: FormField[]
    }) => data,
  )
  .handler(({ data }) =>
    request<void>(
      `/manager/branches/${pathID(data.branchId)}/services/${pathID(data.serviceId)}/form`,
      'PUT',
      {
        allowsUploads: data.allowsUploads,
        requiresDocuments: data.requiresDocuments,
        documentGuidance: data.documentGuidance,
        fields: data.fields.map(({ type, label, required, options }) => ({
          type,
          label,
          required,
          options,
        })),
      },
    ),
  )

export const createManagerCounter = createServerFn({ method: 'POST' })
  .validator((data: { branchId: string; name: string }) => data)
  .handler(({ data }) =>
    request<void>(`/manager/branches/${pathID(data.branchId)}/counters`, 'POST', {
      name: data.name,
    }),
  )

export const updateManagerCounter = createServerFn({ method: 'POST' })
  .validator((data: { branchId: string; counterId: string; name: string; active: boolean }) => data)
  .handler(({ data }) =>
    request<void>(
      `/manager/branches/${pathID(data.branchId)}/counters/${pathID(data.counterId)}`,
      'PATCH',
      { name: data.name, active: data.active },
    ),
  )

export const saveCounterAssignments = createServerFn({ method: 'POST' })
  .validator(
    (data: { branchId: string; counterId: string; queueIds: string[]; operatorIds: string[] }) =>
      data,
  )
  .handler(({ data }) =>
    request<void>(
      `/manager/branches/${pathID(data.branchId)}/counters/${pathID(data.counterId)}/assignments`,
      'PUT',
      { queueIds: data.queueIds.map(pathID), operatorIds: data.operatorIds.map(pathID) },
    ),
  )

export const getServiceSummary = createServerFn({ method: 'GET' })
  .validator((data: { branchId: string; serviceId: string; from: string; to: string }) => data)
  .handler(({ data }) => {
    const params = new URLSearchParams({ from: data.from, to: data.to })
    return request<ServiceSummary>(
      `/manager/branches/${pathID(data.branchId)}/services/${pathID(data.serviceId)}/summary?${params}`,
    )
  })

export const managerBranchesOptions = queryOptions({
  queryKey: ['manager', 'branches'],
  queryFn: getManagedBranches,
})
export const managerCatalogOptions = (branchId: string) =>
  queryOptions({
    queryKey: ['manager', branchId, 'catalog'],
    queryFn: () => getManagerCatalog({ data: branchId }),
    enabled: Boolean(branchId),
  })
