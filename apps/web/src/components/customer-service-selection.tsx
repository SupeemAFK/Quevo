import { type FormEvent, useState } from 'react'
import type { components } from '@/client/api/schema'
import { Button } from './ui/button'

type ServiceOption = components['schemas']['queue.ServiceResponse']

type CustomerServiceSelectionProps = {
  services: ServiceOption[]
  joining: boolean
  error: string
  onJoin: (service: ServiceOption) => void
}

export function CustomerServiceSelection({
  services,
  joining,
  error,
  onJoin,
}: CustomerServiceSelectionProps) {
  const [selectedServiceID, setSelectedServiceID] = useState('')
  const [selectionError, setSelectionError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selectedService = services.find((service) => service.id === selectedServiceID)
    if (!selectedService) {
      setSelectionError('Select a service before joining the queue.')
      return
    }
    setSelectionError('')
    onJoin(selectedService)
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          No active services are available right now.
        </p>
      ) : (
        <fieldset className="space-y-3" disabled={joining}>
          <legend className="mb-3 text-sm font-medium">Choose a service</legend>
          {services.map((service) => {
            const selected = selectedServiceID === service.id
            return (
              <button
                aria-label={`${service.name} at ${service.branchName}`}
                aria-pressed={selected}
                className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}
                key={service.id}
                onClick={() => {
                  setSelectedServiceID(service.id)
                  setSelectionError('')
                }}
                type="button"
              >
                <span>
                  <span className="block font-medium">{service.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {service.branchName}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">{selected ? 'Selected' : ''}</span>
              </button>
            )
          })}
        </fieldset>
      )}

      {selectionError ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {selectionError}
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={joining || services.length === 0} type="submit">
        {joining ? 'Joining queue…' : 'Join queue'}
      </Button>
    </form>
  )
}
