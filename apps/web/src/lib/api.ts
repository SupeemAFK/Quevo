import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getApiHealth } from './api-client'

const fetchApiHealth = createServerFn({ method: 'GET' }).handler(async () => {
  const apiURL = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
  return getApiHealth(`${apiURL}/api/v1`)
})

export const apiHealthOptions = queryOptions({
  queryKey: ['api', 'health'],
  queryFn: () => fetchApiHealth(),
  staleTime: 30_000,
})
