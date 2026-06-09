export type ThemeId = 'sleeper' | 'glass'

export interface ThemeOption {
  id: ThemeId
  label: string
  description: string
}

export const THEMES: ThemeOption[] = [
  { id: 'sleeper', label: 'Sleeper', description: 'Dark & neon' },
  { id: 'glass', label: 'Glass', description: 'White-on-white iOS glass' },
]

const THEME_KEY = 'cd-theme'
const MODE_KEY = 'cd-dark-mode'

export function useTheme() {
  const theme = useState<ThemeId>('cd-theme', () => 'glass')
  // Dark mode is the default; overridden only by a saved preference (see init()).
  const isDark = useState<boolean>('cd-dark-mode', () => true)

  // Reflect current state to the DOM. Persists the theme choice, but NOT
  // the mode — mode is only persisted on an explicit user toggle so that a
  // fresh profile keeps following the system setting (see init()).
  function apply() {
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', theme.value)
      document.documentElement.setAttribute('data-mode', isDark.value ? 'dark' : 'light')
      localStorage.setItem(THEME_KEY, theme.value)
    }
  }

  function setTheme(id: ThemeId) {
    theme.value = id
    apply()
  }

  function toggleDarkMode() {
    isDark.value = !isDark.value
    apply()
    // Explicit user choice — persist it and stop tracking the system setting.
    if (import.meta.client) {
      localStorage.setItem(MODE_KEY, isDark.value ? 'dark' : 'light')
    }
  }

  function init() {
    if (import.meta.client) {
      let savedTheme = localStorage.getItem(THEME_KEY) as string | null
      // Migrate legacy "modern" theme to "glass"
      if (savedTheme === 'modern') savedTheme = 'glass'
      if (savedTheme && THEMES.some((t) => t.id === savedTheme)) {
        theme.value = savedTheme as ThemeId
      }
      const savedMode = localStorage.getItem(MODE_KEY)
      if (savedMode === 'light' || savedMode === 'dark') {
        isDark.value = savedMode === 'dark'
      } else {
        // No explicit preference yet — dark mode is the default.
        isDark.value = true
      }
      apply()
    }
  }

  return { theme, isDark, setTheme, toggleDarkMode, init, THEMES }
}
