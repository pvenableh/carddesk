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

export function useCdPalette() {
  const palette = useState<CdPaletteId>('cd-palette', () => 'seaMist')
  const paletteTint = useState<boolean>('cd-palette-tint', () => true)

  function apply() {
    if (!import.meta.client) return
    applyCdPaletteToDocument(palette.value)
    document.documentElement.setAttribute(
      'data-cd-tint',
      paletteTint.value ? 'on' : 'off',
    )
    try {
      localStorage.setItem(PALETTE_KEY, palette.value)
      localStorage.setItem(TINT_KEY, paletteTint.value ? 'on' : 'off')
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

  function init(): void {
    if (!import.meta.client) return
    const savedPalette = localStorage.getItem(PALETTE_KEY)
    if (savedPalette) palette.value = resolvePaletteId(savedPalette)
    const savedTint = localStorage.getItem(TINT_KEY)
    // Default to ON when no preference has been saved — first-load users
    // see the tint and discover the toggle in account settings.
    paletteTint.value = savedTint === null ? true : savedTint === 'on'
    apply()
  }

  return {
    palette,
    setPalette,
    paletteIds: CD_PALETTE_IDS,
    palettes: CD_PALETTES,
    paletteTint,
    setPaletteTint,
    init,
  }
}
