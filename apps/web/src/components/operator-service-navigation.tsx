import { Check, Layers3, MapPin } from 'lucide-react'
import { motion } from 'motion/react'
import type { components } from '@/client/api/schema'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

type QueueOption = components['schemas']['queue.OperatorQueueResponse']

type Props = {
  queues: QueueOption[]
  selectedQueueKey: string
  onSelect: (queue: QueueOption) => void
}

function keyFor(queue: QueueOption) {
  return `${queue.branchId}:${queue.queueId}`
}

export function OperatorServiceNavigation({ queues, selectedQueueKey, onSelect }: Props) {
  if (queues.length < 2) return null

  return (
    <>
      <div className="min-w-0 lg:hidden">
        <label
          className="mb-2 flex items-center gap-2 text-sm font-medium"
          htmlFor="operator-service-select"
        >
          <Layers3 aria-hidden="true" size={16} />
          Service
        </label>
        <Select
          onValueChange={(value) => {
            const queue = queues.find((item) => keyFor(item) === value)
            if (queue) onSelect(queue)
          }}
          value={selectedQueueKey}
        >
          <SelectTrigger className="min-h-11 w-full min-w-0" id="operator-service-select">
            <SelectValue className="min-w-0 flex-1 truncate" />
          </SelectTrigger>
          <SelectContent>
            {queues.map((queue) => (
              <SelectItem key={keyFor(queue)} value={keyFor(queue)}>
                {queue.serviceName} · {queue.queueName} · {queue.branchName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav aria-label="Assigned queues" className="hidden min-w-0 lg:block">
        <h2 className="mb-3 text-base font-semibold">Assigned services</h2>
        <ul className="divide-y border-y">
          {queues.map((queue) => {
            const active = selectedQueueKey === keyFor(queue)
            return (
              <li key={keyFor(queue)}>
                <motion.button
                  aria-pressed={active}
                  className={`relative min-h-16 w-full border-l-2 py-3 pl-3 pr-2 text-left transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? 'border-l-brand-green font-semibold text-foreground' : 'border-l-transparent text-foreground'}`}
                  onClick={() => onSelect(queue)}
                  type="button"
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.995 }}
                >
                  {active ? (
                    <motion.span
                      aria-hidden="true"
                      className="absolute -left-0.5 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-brand-green"
                      layoutId="operator-selected-service"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="flex items-center justify-between gap-2 truncate">
                    <span className="flex items-center gap-2 truncate">
                      <Layers3 aria-hidden="true" className="shrink-0" size={16} />
                      {queue.serviceName} · {queue.queueName}
                    </span>
                    {active ? (
                      <Check aria-hidden="true" className="shrink-0 text-brand-green" size={16} />
                    ) : null}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 truncate text-sm font-normal text-muted-foreground">
                    <MapPin aria-hidden="true" size={13} />
                    {queue.branchName}
                  </span>
                </motion.button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
