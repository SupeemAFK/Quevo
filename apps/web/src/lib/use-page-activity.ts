import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  document.addEventListener('visibilitychange', onChange)
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    document.removeEventListener('visibilitychange', onChange)
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function getSnapshot() {
  return typeof window !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine
}

function getServerSnapshot() {
  return false
}

export function usePageActivity() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
