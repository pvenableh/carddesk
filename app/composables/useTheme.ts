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
  const theme = useState<ThemeId>('cd-theme', () => 'sleeper')
  const isDark = useState<boolean>('cd-dark-mode', () => true)

  function apply() {
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', theme.value)
      document.documentElement.setAttribute('data-mode', isDark.value ? 'dark' : 'light')
      localStorage.setItem(THEME_KEY, theme.value)
      localStorage.setItem(MODE_KEY, isDark.value ? 'dark' : 'light')
    }
  }

  function setTheme(id: ThemeId) {
    theme.value = id
    apply()
  }

  function toggleDarkMode() {
    isDark.value = !isDark.value
    apply()
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
      }
      apply()
    }
  }

  return { theme, isDark, setTheme, toggleDarkMode, init, THEMES }
}
