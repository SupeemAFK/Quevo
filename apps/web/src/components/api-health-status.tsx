import type { HealthResponse } from '@/lib/api-client'

export function ApiHealthStatus({ health }: { health: HealthResponse }) {
  return (
    <div className="mb-6 rounded-lg bg-muted px-4 py-3 text-sm font-medium" role="status">
      API status: {health.status}
    </div>
  )
}
