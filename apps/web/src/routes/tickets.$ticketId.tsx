import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeft, RefreshCw, Ticket } from 'lucide-react'
import { useState } from 'react'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { CustomerTicketDetails } from '@/components/customer-ticket-details'
import { FeedbackMessage, LoadingMessage } from '@/components/feedback-message'
import { PageHeading } from '@/components/page-heading'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import {
  cancelCustomerTicket,
  customerQueueOptions,
  customerTicketOptions,
} from '@/lib/customer-queue'
import { ticketDocumentsOptions, uploadTicketDocument } from '@/lib/ticket-documents'
import { usePageActivity } from '@/lib/use-page-activity'

export const Route = createFileRoute('/tickets/$ticketId')({
  component: CustomerTicketPage,
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'CUSTOMER') throw redirect({ to: '/' })
    return { user }
  },
})

function CustomerTicketPage() {
  const { user } = Route.useRouteContext()
  const { ticketId } = Route.useParams()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<{ message: string; kind: 'success' | 'error' } | null>(
    null,
  )
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const pageActive = usePageActivity()
  const ticketQuery = useQuery({
    ...customerTicketOptions(user.id, ticketId),
    refetchInterval: pageActive ? 10_000 : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
  const documentsQuery = useQuery({
    ...ticketDocumentsOptions(`customer:${user.id}`, ticketId),
    enabled: Boolean(ticketQuery.data?.allowsUploads),
  })
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadTicketDocument(ticketId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ticketDocumentsOptions(`customer:${user.id}`, ticketId).queryKey,
      })
      setFeedback({ message: 'Document uploaded.', kind: 'success' })
    },
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelCustomerTicket({ data: ticketId }),
    onSuccess: async (ticket) => {
      queryClient.setQueryData(customerTicketOptions(user.id, ticketId).queryKey, ticket)
      await queryClient.invalidateQueries({ queryKey: customerQueueOptions(user.id).queryKey })
      setFeedback({ message: 'Ticket cancelled.', kind: 'success' })
      setCancelDialogOpen(false)
    },
  })

  async function refreshStatus() {
    if (ticketQuery.isFetching) return
    setFeedback(null)
    const result = await ticketQuery.refetch()
    setFeedback(
      result.isError
        ? { message: 'Could not refresh ticket status. Please try again.', kind: 'error' }
        : { message: 'Ticket status updated.', kind: 'success' },
    )
  }

  return (
    <AuthenticatedShell currentSection="customer" user={user}>
      <section className="mx-auto max-w-4xl p-0 sm:p-2">
        <header className="mb-7">
          <Link
            className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline"
            to="/customer"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Back to services
          </Link>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Customer
          </p>
          <PageHeading className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Ticket aria-hidden="true" size={25} />
            Your ticket
          </PageHeading>
        </header>

        {ticketQuery.isPending ? (
          <LoadingMessage>Loading your ticket…</LoadingMessage>
        ) : ticketQuery.data ? (
          <CustomerTicketDetails
            cancelling={cancelMutation.isPending}
            documents={documentsQuery.data}
            documentsError={documentsQuery.isError ? documentsQuery.error.message : ''}
            feedback={
              feedback ??
              (cancelMutation.error
                ? { message: cancelMutation.error.message, kind: 'error' }
                : uploadMutation.error
                  ? { message: uploadMutation.error.message, kind: 'error' }
                  : ticketQuery.isRefetchError
                    ? {
                        message:
                          'Could not sync the latest status. Showing the last saved ticket; try refreshing again.',
                        kind: 'error',
                      }
                    : null)
            }
            onCancel={() => {
              cancelMutation.reset()
              setFeedback(null)
              setCancelDialogOpen(true)
            }}
            onRefresh={() => void refreshStatus()}
            onUpload={(file) => {
              setFeedback(null)
              uploadMutation.mutate(file)
            }}
            refreshing={ticketQuery.isFetching}
            uploading={uploadMutation.isPending}
            ticket={ticketQuery.data}
          />
        ) : ticketQuery.isError ? (
          <div className="my-6 space-y-4">
            <FeedbackMessage kind="error">{ticketQuery.error.message}</FeedbackMessage>
            <Button
              aria-disabled={ticketQuery.isFetching}
              className="min-h-11 px-4 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              onClick={() => void refreshStatus()}
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={
                  ticketQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : undefined
                }
              />
              {ticketQuery.isFetching ? 'Refreshing…' : 'Try again'}
            </Button>
          </div>
        ) : null}
        <AlertDialog
          onOpenChange={(open) => {
            if (!cancelMutation.isPending) setCancelDialogOpen(open)
          }}
          open={cancelDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave this queue?</AlertDialogTitle>
              <AlertDialogDescription>
                Your waiting ticket will be cancelled and cannot be restored. You can join an active
                service again if you still need help.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {cancelMutation.error ? (
              <p className="text-sm text-status-danger" role="alert">
                {cancelMutation.error.message}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelMutation.isPending}>
                Keep my ticket
              </AlertDialogCancel>
              <Button
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
                variant="destructive"
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Leave queue'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </AuthenticatedShell>
  )
}
