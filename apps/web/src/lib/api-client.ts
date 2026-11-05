import createClient from 'openapi-fetch'
import type { components, paths } from '@/client/api/schema'

export type HealthResponse = components['schemas']['health.Response']

export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl })
}

export async function getApiHealth(baseUrl: string): Promise<HealthResponse> {
  const { data, error } = await createApiClient(baseUrl).GET('/health')

  if (error) throw new Error('API health request failed')
  if (!data) throw new Error('API health response was empty')

  return data
}
