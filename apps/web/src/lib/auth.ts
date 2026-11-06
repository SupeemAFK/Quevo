import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie, setResponseHeader } from '@tanstack/react-start/server'
import type { components } from '@/client/api/schema'
import { createApiClient } from './api-client'

export type Identity = components['schemas']['auth.Identity']

export type LoginInput = {
  identifier: string
  password: string
}

const sessionCookieName = 'quevo_session'

function apiBaseUrl() {
  return (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
}

export const signIn = createServerFn({ method: 'POST' })
  .validator((data: LoginInput) => ({
    identifier: data.identifier.trim(),
    password: data.password,
  }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { data: result, response } = await createApiClient(`${apiBaseUrl()}/api/v1`).POST(
      '/auth/login',
      { body: data },
    )

    if (!response.ok || !result) {
      throw new Error('Sign in failed')
    }

    const maxAge = Math.floor((Date.parse(result.expiresAt) - Date.now()) / 1000)
    if (maxAge <= 0) throw new Error('Sign in failed')

    setCookie(sessionCookieName, result.sessionToken, {
      ...cookieOptions(),
      maxAge,
    })

    // The opaque session token stays in the server-side cookie, never in the
    // server-function result sent back to the browser.
    return result.user
  })

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const sessionToken = getCookie(sessionCookieName)
  if (!sessionToken) return null

  const { data, response } = await createApiClient(`${apiBaseUrl()}/api/v1`).GET('/auth/me', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })

  if (response.status === 401) {
    deleteCookie(sessionCookieName, cookieOptions())
    return null
  }
  if (!response.ok || !data) throw new Error('Could not load the current user')

  return data.user
})

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const sessionToken = getCookie(sessionCookieName)

  if (sessionToken) {
    const { response } = await createApiClient(`${apiBaseUrl()}/api/v1`).POST('/auth/logout', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    if (!response.ok && response.status !== 401) throw new Error('Could not sign out')
  }

  deleteCookie(sessionCookieName, cookieOptions())
})
