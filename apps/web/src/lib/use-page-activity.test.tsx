import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { usePageActivity } from './use-page-activity'

const originalVisibility = document.visibilityState
const originalOnline = navigator.onLine

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: originalVisibility,
  })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnline })
})

describe('usePageActivity', () => {
  it('pauses while hidden or offline and resumes when visible and online', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    const { result } = renderHook(() => usePageActivity())
    expect(result.current).toBe(true)

    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})
