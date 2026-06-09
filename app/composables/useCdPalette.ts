/**
 * useCdPalette — per-device palette + tint state for CardDesk's glass
 * theme. Mirrors Earnest's `useAppPalette`/`paletteTint` pattern in
 * minimal form: state in `useState`, persisted to localStorage (no
 * Directus schema — CardDesk's auth is separate and these are pure
 * chrome preferences anyway).
 *
 *   palette       — id from `CD_PALETTE_IDS`
 *   paletteTint   — boolean (default ON); when ON, glass surfaces wear
 *                   the palette's 4-stop gradient instead of the
 *                   frosted-grey baseline.
 *
 * Call `init()` once on app boot (from `app.vue`) to hydrate from
 * localStorage and apply attrs to `<html>`. Setters re-apply
 * immediately so the UI flips with no plugin/watcher plumbing.
 */
import {
  CD_PALETTES,
  CD_PALETTE_IDS,
  applyCdPaletteToDocument,
  resolvePaletteId,
  type CdPaletteId,
} from '~/composables/useCdAccent'

const PALETTE_KEY = 'cd-palette'
const TINT_KEY = 'cd-palette-tint'
const GLASS_KEY = 'cd-glass-intensity'
const CHROME_KEY = 'cd-glass-chrome'

export type GlassIntensity = 'full' | 'restrained'

export function useCdPalette() {
  const palette = useState<CdPaletteId>('cd-palette', () => 'seaMist')
  const paletteTint = useState<boolean>('cd-palette-tint', () => true)
  // 'full' = ambient tinted background + translucent liquid-glass cards.
  // 'restrained' = neutral background, flat clean cards, glass only on chrome.
  const glassIntensity = useState<GlassIntensity>('cd-glass-intensity', () => 'full')
  // Glass chrome (Earnest parity): when on, primary buttons + chips become
  // frosted translucent with palette-tinted accents instead of solid fills.
  // data-surface = 'glass' | 'solid'. Default off (bold solid CTAs).
  const glassChrome = useState<boolean>('cd-glass-chrome', () => false)

  function apply() {
    if (!import.meta.client) return
    applyCdPaletteToDocument(palette.value)
    document.documentElement.setAttribute(
      'data-cd-tint',
      paletteTint.value ? 'on' : 'off',
    )
    document.documentElement.setAttribute('data-cd-glass', glassIntensity.value)
    document.documentElement.setAttribute(
      'data-surface',
      glassChrome.value ? 'glass' : 'solid',
    )
    try {
      localStorage.setItem(PALETTE_KEY, palette.value)
      localStorage.setItem(TINT_KEY, paletteTint.value ? 'on' : 'off')
      localStorage.setItem(GLASS_KEY, glassIntensity.value)
      localStorage.setItem(CHROME_KEY, glassChrome.value ? 'on' : 'off')
    } catch {
      // Quota / private-mode — keep the in-memory state so the UI still
      // reflects the user's intent for this session.
    }
  }

  function setPalette(next: CdPaletteId): void {
    if (!CD_PALETTE_IDS.includes(next)) return
    palette.value = next
    apply()
  }

  function setPaletteTint(next: boolean): void {
    paletteTint.value = next
    apply()
  }

  function setGlassIntensity(next: GlassIntensity): void {
    glassIntensity.value = next
    apply()
  }

  function setGlassChrome(next: boolean): void {
    glassChrome.value = next
    apply()
  }

  function init(): void {
    if (!import.meta.client) return
    const savedPalette = localStorage.getItem(PALETTE_KEY)
    if (savedPalette) palette.value = resolvePaletteId(savedPalette)
    const savedTint = localStorage.getItem(TINT_KEY)
    // Default to ON when no preference has been saved — first-load users
    // see the tint and discover the toggle in account settings.
    paletteTint.value = savedTint === null ? true : savedTint === 'on'
    const savedGlass = localStorage.getItem(GLASS_KEY)
    glassIntensity.value = savedGlass === 'restrained' ? 'restrained' : 'full'
    const savedChrome = localStorage.getItem(CHROME_KEY)
    glassChrome.value = savedChrome === 'on'
    apply()
  }

  return {
    palette,
    setPalette,
    paletteIds: CD_PALETTE_IDS,
    palettes: CD_PALETTES,
    paletteTint,
    setPaletteTint,
    glassIntensity,
    setGlassIntensity,
    glassChrome,
    setGlassChrome,
    init,
  }
}
