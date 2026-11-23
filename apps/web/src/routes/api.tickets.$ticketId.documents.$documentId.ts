import { createFileRoute } from '@tanstack/react-router'
import { getCookie } from '@tanstack/react-start/server'
import { SESSION_COOKIE_NAME } from '@/lib/session'

export const Route = createFileRoute('/api/tickets/$ticketId/documents/$documentId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = getCookie(SESSION_COOKIE_NAME)
        if (!token) return new Response('Authentication required', { status: 401 })
        const baseURL = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
        try {
          const upstream = await fetch(
            `${baseURL}/api/v1/tickets/${encodeURIComponent(params.ticketId)}/documents/${encodeURIComponent(params.documentId)}`,
            { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
          )
          const headers = new Headers({
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
            'Content-Disposition': upstream.headers.get('Content-Disposition') ?? 'attachment',
          })
          return new Response(upstream.body, { status: upstream.status, headers })
        } catch {
          return new Response('Document service is unavailable.', { status: 503 })
        }
      },
    },
  },
})
