;(() => {
  try {
    const saved = window.localStorage.getItem('quevo-theme')
    const preference =
      saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
    const followsDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle(
      'dark',
      preference === 'dark' || (preference === 'system' && followsDarkSystem),
    )
  } catch {
    // The CSS light theme remains available when browser storage is unavailable.
  }
})()
