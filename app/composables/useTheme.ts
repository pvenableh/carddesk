export type ThemeId = 'sleeper' | 'modern'

export interface ThemeOption {
  id: ThemeId
  label: string
  description: string
}

export const THEMES: ThemeOption[] = [
  { id: 'sleeper', label: 'Sleeper', description: 'Dark & neon' },
  { id: 'modern', label: 'Modern', description: 'Clean & minimal' },
]

const STORAGE_KEY = 'cd-theme'

export function useTheme() {
  const theme = useState<ThemeId>('cd-theme', () => 'sleeper')

  function applyTheme(id: ThemeId) {
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', id)
      localStorage.setItem(STORAGE_KEY, id)
    }
  }

  function setTheme(id: ThemeId) {
    theme.value = id
    applyTheme(id)
  }

  function init() {
    if (import.meta.client) {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null
      if (saved && THEMES.some((t) => t.id === saved)) {
        theme.value = saved
      }
      applyTheme(theme.value)
    }
  }

  return { theme, setTheme, init, THEMES }
}
