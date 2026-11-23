import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  preference: ThemePreference
  ready: boolean
  setPreference: (preference: ThemePreference) => void
}

const storageKey = 'quevo-theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(preference: ThemePreference) {
  const followsDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle(
    'dark',
    preference === 'dark' || (preference === 'system' && followsDarkSystem),
  )
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const savedPreference = window.localStorage.getItem(storageKey)
      if (isThemePreference(savedPreference)) setPreference(savedPreference)
    } catch {
      // Keep the system preference when browser storage is unavailable.
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return

    applyTheme(preference)
    try {
      window.localStorage.setItem(storageKey, preference)
    } catch {
      // The in-memory selection still works when browser storage is unavailable.
    }
  }, [preference, ready])

  useEffect(() => {
    if (!ready || preference !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => applyTheme('system')
    mediaQuery.addEventListener('change', updateTheme)
    return () => mediaQuery.removeEventListener('change', updateTheme)
  }, [preference, ready])

  const contextValue = useMemo(() => ({ preference, ready, setPreference }), [preference, ready])

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useThemePreference() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useThemePreference must be used inside ThemeProvider')
  return context
}
