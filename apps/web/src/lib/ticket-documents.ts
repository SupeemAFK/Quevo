import { queryOptions } from '@tanstack/react-query'

export type TicketDocument = {
  id: string
  fileName: string
  mediaType: string
  byteSize: number
  createdAt: string
}

export async function getTicketDocuments(ticketId: string): Promise<TicketDocument[]> {
  const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/documents`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Could not load your documents. Please try again.')
  const result = (await response.json()) as { items?: TicketDocument[] }
  return result.items ?? []
}

export async function uploadTicketDocument(ticketId: string, file: File): Promise<TicketDocument> {
  const form = new FormData()
  form.set('file', file)
  const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/documents`, {
    method: 'POST',
    headers: { 'X-Quevo-Request': '1' },
    body: form,
  })
  if (!response.ok) {
    if (response.status === 400 || response.status === 413)
      throw new Error('Choose a PDF, PNG, or JPG file under 10 MB.')
    if (response.status === 403)
      throw new Error('Documents are not enabled for this service or ticket.')
    throw new Error('Could not upload this document. Please try again.')
  }
  return (await response.json()) as TicketDocument
}

export const ticketDocumentsOptions = (scope: string, ticketId: string) =>
  queryOptions({
    queryKey: [scope, 'tickets', ticketId, 'documents'],
    queryFn: () => getTicketDocuments(ticketId),
  })
