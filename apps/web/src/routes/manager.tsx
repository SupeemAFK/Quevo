import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Building2, Plus, Save, Settings2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { DatePicker } from '@/components/date-picker'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { PageHeading } from '@/components/page-heading'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCurrentUser } from '@/lib/auth'
import {
  createManagerCounter,
  createManagerQueue,
  createManagerService,
  type FormField,
  getServiceSummary,
  type ManagerCatalog,
  type ManagerCounter,
  type ManagerService,
  managerBranchesOptions,
  managerCatalogOptions,
  saveCounterAssignments,
  saveManagerForm,
  updateManagerCounter,
  updateManagerQueue,
  updateManagerService,
} from '@/lib/manager'

export const Route = createFileRoute('/manager')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'BRANCH_MANAGER') throw redirect({ to: '/' })
    return { user }
  },
  component: ManagerPage,
})

function ManagerPage() {
  const { user } = Route.useRouteContext()
  const client = useQueryClient()
  const branches = useQuery(managerBranchesOptions)
  const [branchId, setBranchId] = useState('')
  const selectedBranch = branchId || branches.data?.[0]?.id || ''
  const catalog = useQuery(managerCatalogOptions(selectedBranch))
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [counterName, setCounterName] = useState('')

  async function refresh() {
    await client.invalidateQueries({ queryKey: managerCatalogOptions(selectedBranch).queryKey })
  }

  const update = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onMutate: () => {
      setNotice('')
      setError('')
    },
    onSuccess: async () => {
      await refresh()
      setNotice('Branch settings saved.')
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : 'Could not save branch settings.'),
  })

  function save(run: () => Promise<unknown>) {
    update.mutate(run)
  }

  return (
    <AuthenticatedShell currentSection="manager" user={user}>
      <div className="space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Branch manager
            </p>
            <PageHeading className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
              <Building2 aria-hidden="true" size={25} /> Branch setup
            </PageHeading>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Manage the services customers can join, the documents each service accepts, and which
              operators work at each counter.
            </p>
          </div>
          {branches.data && branches.data.length > 1 ? (
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="manager-branch">
              Branch
              <Select onValueChange={setBranchId} value={selectedBranch}>
                <SelectTrigger className="min-h-11 min-w-56" id="manager-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.data.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : branches.data?.[0] ? (
            <p className="text-sm text-muted-foreground">{branches.data[0].name}</p>
          ) : null}
        </header>

        {branches.isPending ? <LoadingMessage>Loading managed branches…</LoadingMessage> : null}
        {branches.isError ? (
          <FeedbackMessage kind="error">{branches.error.message}</FeedbackMessage>
        ) : null}
        {catalog.isPending && selectedBranch ? (
          <LoadingMessage>Loading branch setup…</LoadingMessage>
        ) : null}
        {catalog.isError ? (
          <FeedbackMessage kind="error">{catalog.error.message}</FeedbackMessage>
        ) : null}
        {error ? <FeedbackMessage kind="error">{error}</FeedbackMessage> : null}
        {notice ? <FeedbackMessage kind="success">{notice}</FeedbackMessage> : null}
        {branches.data?.length === 0 ? (
          <p className="border-y py-5 text-sm text-muted-foreground">
            No branch is assigned to your manager account.
          </p>
        ) : null}

        {catalog.data ? (
          <>
            <section aria-labelledby="catalog-heading" className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight" id="catalog-heading">
                    Service catalog
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Each service can have its own request fields, queues and document policy.
                  </p>
                </div>
                <form
                  className="flex w-full gap-2 sm:w-auto"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (serviceName.trim())
                      save(async () => {
                        await createManagerService({
                          data: { branchId: selectedBranch, name: serviceName.trim() },
                        })
                        setServiceName('')
                      })
                  }}
                >
                  <input
                    aria-label="New service name"
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm sm:w-56"
                    maxLength={80}
                    onChange={(event) => setServiceName(event.target.value)}
                    placeholder="Add a bank service"
                    value={serviceName}
                  />
                  <Button className="min-h-11" disabled={update.isPending || !serviceName.trim()}>
                    <Plus aria-hidden="true" /> Add
                  </Button>
                </form>
              </div>
              {catalog.data.services.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  No services yet. Add the services customers should be able to join.
                </p>
              ) : null}
              <div className="divide-y">
                {catalog.data.services.map((service) => (
                  <ServiceEditor
                    key={service.id}
                    branchId={selectedBranch}
                    service={service}
                    busy={update.isPending}
                    onSave={save}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby="counters-heading" className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                <div>
                  <h2
                    className="flex items-center gap-2 text-xl font-semibold tracking-tight"
                    id="counters-heading"
                  >
                    <UsersRound aria-hidden="true" size={20} /> Counters and assignments
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A counter can serve one or more queues and be shared by assigned operators.
                  </p>
                </div>
                <form
                  className="flex w-full gap-2 sm:w-auto"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (counterName.trim())
                      save(async () => {
                        await createManagerCounter({
                          data: { branchId: selectedBranch, name: counterName.trim() },
                        })
                        setCounterName('')
                      })
                  }}
                >
                  <input
                    aria-label="New counter name"
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm sm:w-48"
                    maxLength={80}
                    onChange={(event) => setCounterName(event.target.value)}
                    placeholder="Counter name"
                    value={counterName}
                  />
                  <Button className="min-h-11" disabled={update.isPending || !counterName.trim()}>
                    <Plus aria-hidden="true" /> Add
                  </Button>
                </form>
              </div>
              <div className="divide-y">
                {catalog.data.counters.map((counter) => (
                  <CounterEditor
                    key={counter.id}
                    branchId={selectedBranch}
                    counter={counter}
                    catalog={catalog.data}
                    busy={update.isPending}
                    onSave={save}
                  />
                ))}
              </div>
            </section>

            <SummarySection branchId={selectedBranch} services={catalog.data.services} />
          </>
        ) : null}
      </div>
    </AuthenticatedShell>
  )
}

function ServiceEditor({
  branchId,
  service,
  busy,
  onSave,
}: {
  branchId: string
  service: ManagerService
  busy: boolean
  onSave: (run: () => Promise<unknown>) => void
}) {
  const [name, setName] = useState(service.name)
  const [queueName, setQueueName] = useState('')
  const [fields, setFields] = useState<FormField[]>(
    service.fields.map((field) => ({ ...field, options: [...field.options] })),
  )
  const [allowsUploads, setAllowsUploads] = useState(service.allowsUploads)
  const [requiresDocuments, setRequiresDocuments] = useState(service.requiresDocuments)
  const [guidance, setGuidance] = useState(service.documentGuidance)

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    )
  }

  return (
    <article className="space-y-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`service-name-${service.id}`}>
            Service name
          </label>
          <input
            id={`service-name-${service.id}`}
            className="min-h-10 min-w-48 flex-1 rounded-md border border-input bg-card px-3 font-semibold"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <Button
            className="min-h-10"
            disabled={busy || !name.trim()}
            onClick={() =>
              onSave(() =>
                updateManagerService({
                  data: {
                    branchId,
                    serviceId: service.id,
                    name: name.trim(),
                    active: service.active,
                  },
                }),
              )
            }
            variant="outline"
          >
            <Save aria-hidden="true" /> Save name
          </Button>
        </div>
        <Button
          className="min-h-10"
          disabled={busy}
          onClick={() =>
            onSave(() =>
              updateManagerService({
                data: { branchId, serviceId: service.id, name, active: !service.active },
              }),
            )
          }
          variant="outline"
        >
          {service.active ? 'Pause service' : 'Activate service'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Queues</h3>
          {service.queues.map((queue) => (
            <div className="flex flex-wrap items-center gap-2" key={queue.id}>
              <span className="min-w-32 flex-1 text-sm">{queue.name}</span>
              <Button
                className="min-h-9"
                disabled={busy}
                onClick={() =>
                  onSave(() =>
                    updateManagerQueue({
                      data: {
                        branchId,
                        queueId: queue.id,
                        name: queue.name,
                        active: !queue.active,
                      },
                    }),
                  )
                }
                variant="outline"
              >
                {queue.active ? 'Pause' : 'Activate'}
              </Button>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (queueName.trim())
                onSave(async () => {
                  await createManagerQueue({
                    data: { branchId, serviceId: service.id, name: queueName.trim() },
                  })
                  setQueueName('')
                })
            }}
          >
            <input
              aria-label={`New queue for ${service.name}`}
              className="min-h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm"
              maxLength={80}
              onChange={(event) => setQueueName(event.target.value)}
              placeholder="Add queue"
              value={queueName}
            />
            <Button className="min-h-10" disabled={busy || !queueName.trim()} variant="outline">
              <Plus aria-hidden="true" /> Add queue
            </Button>
          </form>
        </div>

        <form
          className="space-y-4 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
          onSubmit={(event) => {
            event.preventDefault()
            onSave(() =>
              saveManagerForm({
                data: {
                  branchId,
                  serviceId: service.id,
                  allowsUploads,
                  requiresDocuments,
                  documentGuidance: guidance,
                  fields,
                },
              }),
            )
          }}
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 aria-hidden="true" size={16} /> Customer request form
          </h3>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                checked={allowsUploads}
                onChange={(event) => {
                  setAllowsUploads(event.target.checked)
                  if (!event.target.checked) setRequiresDocuments(false)
                }}
                type="checkbox"
              />
              Allow document uploads
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                checked={requiresDocuments}
                disabled={!allowsUploads}
                onChange={(event) => setRequiresDocuments(event.target.checked)}
                type="checkbox"
              />
              Require documents before service starts
            </label>
          </div>
          {allowsUploads ? (
            <label className="block space-y-1.5 text-sm">
              Document guidance
              <input
                className="min-h-10 w-full rounded-md border border-input bg-card px-3"
                maxLength={500}
                onChange={(event) => setGuidance(event.target.value)}
                placeholder="Tell customers which documents to bring"
                value={guidance}
              />
            </label>
          ) : null}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                Request fields <span className="text-muted-foreground">({fields.length}/5)</span>
              </p>
              <Button
                className="min-h-9"
                disabled={busy || fields.length >= 5}
                onClick={() =>
                  setFields((current) => [
                    ...current,
                    { type: 'short_text', label: '', required: false, options: [] },
                  ])
                }
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" /> Add field
              </Button>
            </div>
            {fields.map((field, index) => (
              <div
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto_auto_auto]"
                key={field.id ?? `new-${index}`}
              >
                <input
                  aria-label={`Field ${index + 1} label`}
                  className="min-h-10 rounded-md border border-input bg-card px-3 text-sm"
                  maxLength={80}
                  onChange={(event) => updateField(index, { label: event.target.value })}
                  placeholder="For example, request type"
                  value={field.label}
                />
                <Select
                  onValueChange={(value) =>
                    updateField(index, {
                      type: value as FormField['type'],
                      options: value === 'single_select' ? ['Option 1'] : [],
                    })
                  }
                  value={field.type}
                >
                  <SelectTrigger
                    aria-label={`Field ${index + 1} type`}
                    className="min-h-10 w-full px-2 text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short_text">Short answer</SelectItem>
                    <SelectItem value="single_select">Choose one</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  aria-label={`Move field ${index + 1} up`}
                  className="min-h-10"
                  disabled={busy || index === 0}
                  onClick={() =>
                    setFields((current) => {
                      const next = [...current]
                      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                      return next
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  <ArrowUp aria-hidden="true" size={16} />
                </Button>
                <Button
                  aria-label={`Move field ${index + 1} down`}
                  className="min-h-10"
                  disabled={busy || index === fields.length - 1}
                  onClick={() =>
                    setFields((current) => {
                      const next = [...current]
                      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                      return next
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  <ArrowDown aria-hidden="true" size={16} />
                </Button>
                <Button
                  aria-label={`Remove field ${index + 1}`}
                  className="min-h-10"
                  onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                  type="button"
                  variant="outline"
                >
                  Remove
                </Button>
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                  <input
                    checked={field.required}
                    onChange={(event) => updateField(index, { required: event.target.checked })}
                    type="checkbox"
                  />
                  Required
                </label>
                {field.type === 'single_select' ? (
                  <input
                    aria-label={`Field ${index + 1} options`}
                    className="min-h-10 rounded-md border border-input bg-card px-3 text-sm sm:col-span-3"
                    onChange={(event) =>
                      updateField(index, {
                        options: event.target.value
                          .split(',')
                          .map((option) => option.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Options separated by commas"
                    value={field.options.join(', ')}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Never ask customers for full account or card numbers, PINs, passwords, OTPs, government
            ID numbers, or income details in a queue form.
          </p>
          <Button
            className="min-h-10"
            disabled={busy || fields.some((field) => !field.label.trim())}
          >
            <Save aria-hidden="true" /> Save customer form
          </Button>
        </form>
      </div>
    </article>
  )
}

function CounterEditor({
  branchId,
  counter,
  catalog,
  busy,
  onSave,
}: {
  branchId: string
  counter: ManagerCounter
  catalog: ManagerCatalog
  busy: boolean
  onSave: (run: () => Promise<unknown>) => void
}) {
  const [name, setName] = useState(counter.name)
  const [queueIds, setQueueIds] = useState(counter.queueIds)
  const [operatorIds, setOperatorIds] = useState(counter.operators.map((operator) => operator.id))
  const queues = catalog.services.flatMap((service) =>
    service.queues.map((queue) => ({ ...queue, service: service.name })),
  )
  function toggle(values: string[], value: string, set: (values: string[]) => void) {
    set(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }
  return (
    <article className="grid gap-5 py-5 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
      <div className="space-y-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Counter name
          <input
            className="min-h-10 rounded-md border border-input bg-card px-3"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-9"
            disabled={busy || !name.trim()}
            onClick={() =>
              onSave(() =>
                updateManagerCounter({
                  data: { branchId, counterId: counter.id, name, active: counter.active },
                }),
              )
            }
            variant="outline"
          >
            <Save aria-hidden="true" /> Save
          </Button>
          <Button
            className="min-h-9"
            disabled={busy}
            onClick={() =>
              onSave(() =>
                updateManagerCounter({
                  data: { branchId, counterId: counter.id, name, active: !counter.active },
                }),
              )
            }
            variant="outline"
          >
            {counter.active ? 'Pause counter' : 'Activate counter'}
          </Button>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Queues served</legend>
          {queues.map((queue) => (
            <label className="flex items-center gap-2 text-sm" key={queue.id}>
              <input
                checked={queueIds.includes(queue.id)}
                onChange={() => toggle(queueIds, queue.id, setQueueIds)}
                type="checkbox"
              />
              {queue.service} · {queue.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Assigned operators</legend>
          {catalog.operators.map((operator) => (
            <label className="flex items-center gap-2 text-sm" key={operator.id}>
              <input
                checked={operatorIds.includes(operator.id)}
                onChange={() => toggle(operatorIds, operator.id, setOperatorIds)}
                type="checkbox"
              />
              {operator.name}
            </label>
          ))}
        </fieldset>
        <Button
          className="min-h-10 sm:col-span-2 sm:justify-self-start"
          disabled={busy}
          onClick={() =>
            onSave(() =>
              saveCounterAssignments({
                data: { branchId, counterId: counter.id, queueIds, operatorIds },
              }),
            )
          }
          variant="outline"
        >
          <Save aria-hidden="true" /> Save assignments
        </Button>
      </div>
    </article>
  )
}

function SummarySection({ branchId, services }: { branchId: string; services: ManagerService[] }) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
  )
  const summary = useQuery({
    queryKey: ['manager', branchId, serviceId, 'summary', from, to],
    queryFn: () => getServiceSummary({ data: { branchId, serviceId, from, to } }),
    enabled: Boolean(branchId && serviceId && from && to && from <= to),
  })
  return (
    <section aria-labelledby="summary-heading" className="space-y-4 border-t pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight" id="summary-heading">
            Service summary
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Branch-scoped queue outcomes for the selected date range.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="grid gap-1 text-xs text-muted-foreground">
            <span id="summary-service-label">Service</span>
            <Select onValueChange={setServiceId} value={serviceId}>
              <SelectTrigger
                aria-labelledby="summary-service-label"
                className="min-h-10 min-w-44 text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <span>From</span>
            <DatePicker ariaLabel="Summary start date" onChange={setFrom} value={from} />
          </div>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <span>To</span>
            <DatePicker ariaLabel="Summary end date" onChange={setTo} value={to} />
          </div>
        </div>
      </div>
      {summary.isError ? (
        <FeedbackMessage kind="error">{summary.error.message}</FeedbackMessage>
      ) : null}
      {summary.data ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Completed', summary.data.completed],
            ['Skipped', summary.data.skipped],
            ['Cancelled', summary.data.cancelled],
            ['No-show', summary.data.noShow],
            ['Average wait', formatSeconds(summary.data.averageWaitSeconds)],
            ['Average service', formatSeconds(summary.data.averageServiceSeconds)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

function formatSeconds(seconds: number | null) {
  if (seconds === null) return '—'
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
