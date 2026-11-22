import { useThemePreference } from './theme-provider'

export function ThemePreferenceSelect() {
  const { preference, ready, setPreference } = useThemePreference()

  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
      <span>Theme</span>
      <select
        aria-label="Color theme"
        className="h-10 min-w-24 rounded-md border border-border bg-card px-2.5 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={!ready}
        onChange={(event) => setPreference(event.currentTarget.value as typeof preference)}
        value={preference}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}
