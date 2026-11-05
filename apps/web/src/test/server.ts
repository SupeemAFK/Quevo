import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const server = setupServer(
  http.get('http://127.0.0.1:8080/api/v1/health', () =>
    HttpResponse.json({ status: 'healthy' }),
  ),
)
