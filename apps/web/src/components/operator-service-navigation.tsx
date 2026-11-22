import type { components } from '@/client/api/schema'

type QueueOption = components['schemas']['queue.OperatorQueueResponse']

type Props = {
  queues: QueueOption[]
  selectedQueueKey: string
  onSelect: (queue: QueueOption) => void
}

function keyFor(queue: QueueOption) {
  return `${queue.branchId}:${queue.serviceId}`
}

export function OperatorServiceNavigation({ queues, selectedQueueKey, onSelect }: Props) {
  if (queues.length < 2) return null

  return (
    <>
      <div className="lg:hidden">
        <label className="mb-2 block text-sm font-medium" htmlFor="operator-service-select">
          Service
        </label>
        <select
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="operator-service-select"
          onChange={(event) => {
            const queue = queues.find((item) => keyFor(item) === event.target.value)
            if (queue) onSelect(queue)
          }}
          value={selectedQueueKey}
        >
          {queues.map((queue) => (
            <option key={keyFor(queue)} value={keyFor(queue)}>
              {queue.serviceName} · {queue.branchName}
            </option>
          ))}
        </select>
      </div>

      <nav aria-label="Assigned queues" className="hidden min-w-0 lg:block">
        <h2 className="mb-3 text-base font-semibold">Assigned services</h2>
        <ul className="divide-y border-y">
          {queues.map((queue) => {
            const active = selectedQueueKey === keyFor(queue)
            return (
              <li key={keyFor(queue)}>
                <button
                  aria-pressed={active}
                  className={`min-h-16 w-full border-l-2 py-3 pl-3 pr-2 text-left transition-colors hover:text-foreground focus-visible:outline ${active ? 'border-l-brand-green font-semibold text-brand-green' : 'border-l-transparent text-foreground'}`}
                  onClick={() => onSelect(queue)}
                  type="button"
                >
                  <span className="block truncate">{queue.serviceName}</span>
                  <span className="mt-1 block truncate text-sm font-normal text-muted-foreground">
                    {queue.branchName}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
