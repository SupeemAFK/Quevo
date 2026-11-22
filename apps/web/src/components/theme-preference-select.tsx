import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemePreference } from './theme-provider'

export function ThemePreferenceSelect() {
  const { preference, ready, setPreference } = useThemePreference()
  const options = [
    { value: 'system', label: 'Use system theme', icon: Monitor },
    { value: 'light', label: 'Use light theme', icon: Sun },
    { value: 'dark', label: 'Use dark theme', icon: Moon },
  ] as const

  return (
    <fieldset className="inline-flex min-h-11 items-center gap-0.5 rounded-lg border border-border bg-background p-1">
      <legend className="sr-only">Color theme</legend>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          aria-label={label}
          aria-pressed={preference === value}
          className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-pressed:bg-foreground aria-pressed:text-background disabled:pointer-events-none disabled:opacity-50"
          disabled={!ready}
          key={value}
          onClick={() => setPreference(value)}
          title={label}
          type="button"
        >
          <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
        </button>
      ))}
      <span className="sr-only" aria-live="polite">{`Theme: ${preference}`}</span>
    </fieldset>
  )
}
