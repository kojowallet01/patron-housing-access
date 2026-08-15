const THEME_KEY = 'aifsp-theme'

export function getInitialTheme() {
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') {
    return saved
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  window.localStorage.setItem(THEME_KEY, theme)
}

export function initTheme() {
  applyTheme(getInitialTheme())
}

export function toggleTheme(currentTheme) {
  const next = currentTheme === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
