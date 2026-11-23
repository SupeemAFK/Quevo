import { createFileRoute } from '@tanstack/react-router'
import { getCookie } from '@tanstack/react-start/server'
import { SESSION_COOKIE_NAME } from '@/lib/session'

const notAllowed = () => new Response('Not allowed', { status: 403 })

function apiURL(ticketId: string) {
  const baseURL = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
  return `${baseURL}/api/v1/tickets/${encodeURIComponent(ticketId)}/documents`
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin)
}

async function proxy(request: Request, ticketId: string, method: 'GET' | 'POST') {
  const token = getCookie(SESSION_COOKIE_NAME)
  if (!token) return new Response('Authentication required', { status: 401 })
  if (
    method === 'POST' &&
    (!sameOrigin(request) || request.headers.get('X-Quevo-Request') !== '1')
  ) {
    return notAllowed()
  }

  const headers = new Headers({ Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store' })
  let body: FormData | undefined
  if (method === 'POST') {
    const incoming = await request.formData()
    const file = incoming.get('file')
    if (!(file instanceof File)) return new Response('Choose a file to upload', { status: 400 })
    body = new FormData()
    body.set('file', file, file.name)
  }

  try {
    const upstream = await fetch(apiURL(ticketId), { method, headers, body, cache: 'no-store' })
    const responseHeaders = new Headers({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    })
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return new Response(JSON.stringify({ message: 'Document service is unavailable.' }), {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    })
  }
}

export const Route = createFileRoute('/api/tickets/$ticketId/documents')({
  server: {
    handlers: {
      GET: ({ request, params }) => proxy(request, params.ticketId, 'GET'),
      POST: ({ request, params }) => proxy(request, params.ticketId, 'POST'),
    },
  },
})
