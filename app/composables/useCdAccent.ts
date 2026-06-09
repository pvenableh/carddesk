/**
 * useCdAccent — palette registry + applyCdPaletteToDocument.
 *
 * Ported (and pruned) from Earnest's `useAppAccent.ts`. CardDesk doesn't
 * have a multi-app rail to colour, so we don't need per-app accents,
 * icon strategies, or semantic token loops. We just need:
 *
 *   1. A list of palettes (id + label + flat source-colour list).
 *   2. A function that picks 4 evenly-spaced colours from the active
 *      palette's source list and writes them to `<html>` as the gradient
 *      stops `--cd-tint-1` … `--cd-tint-4`.
 *   3. A primary-accent var (`--cd-palette-primary`) for any future
 *      consumer that wants the palette's "button" colour without doing
 *      its own pick.
 *
 * Glass surfaces (`.cd-bnav`, `.cd-sbar`) in `carddesk.css` read those
 * vars under `html[data-cd-tint='on']` to paint the palette gradient.
 * Sleeper theme + `data-cd-tint='off'` keep their existing chrome.
 */

export type HSL = { h: number; s: number; l: number }

interface PaletteDef {
  meta: { label: string; hint: string }
  /** Full gradient walked by `pickGappy` for the 4 tint stops. */
  sourceColors: readonly HSL[]
  /** Optional "primary" accent (lifted from the source list) emitted as
   *  `--cd-palette-primary`. Falls back to `sourceColors[0]` if omitted. */
  primary?: HSL
}

/** Sea Mist — Aquamarine → Royal Violet (10 colours, light → deep). */
const SEA_MIST_SOURCE: readonly HSL[] = [
  { h: 163, s: 100, l: 75 },
  { h: 171, s: 80, l: 69 },
  { h: 180, s: 66, l: 63 },
  { h: 188, s: 70, l: 61 },
  { h: 194, s: 73, l: 59 },
  { h: 202, s: 69, l: 59 },
  { h: 213, s: 64, l: 59 },
  { h: 239, s: 53, l: 59 },
  { h: 261, s: 60, l: 48 },
  { h: 278, s: 100, l: 36 },
] as const

/** Aurora — Neon Pink → Sky Aqua (9 colours, warm → cool). */
const AURORA_SOURCE: readonly HSL[] = [
  { h: 333, s: 93, l: 56 },
  { h: 309, s: 77, l: 40 },
  { h: 292, s: 84, l: 39 },
  { h: 276, s: 91, l: 38 },
  { h: 268, s: 88, l: 36 },
  { h: 230, s: 83, l: 60 },
  { h: 221, s: 84, l: 60 },
  { h: 212, s: 84, l: 61 },
  { h: 194, s: 85, l: 62 },
] as const

/** Neutral — Sky Aqua → Yale Blue 2 (10 colours, bright cyan → deep navy). */
const NEUTRAL_SOURCE: readonly HSL[] = [
  { h: 196, s: 100, l: 50 },
  { h: 192, s: 97, l: 47 },
  { h: 193, s: 92, l: 45 },
  { h: 193, s: 88, l: 43 },
  { h: 195, s: 83, l: 40 },
  { h: 196, s: 77, l: 38 },
  { h: 200, s: 71, l: 35 },
  { h: 206, s: 64, l: 33 },
  { h: 214, s: 55, l: 30 },
  { h: 220, s: 45, l: 28 },
] as const

/** High Contrast — bold, max-saturation hues spread wide for maximum pop. */
const HIGH_CONTRAST_SOURCE: readonly HSL[] = [
  { h: 222, s: 95, l: 55 }, // electric blue
  { h: 270, s: 90, l: 58 }, // violet
  { h: 320, s: 92, l: 56 }, // magenta
  { h: 5, s: 90, l: 58 }, // red-orange
  { h: 40, s: 98, l: 54 }, // amber
  { h: 150, s: 85, l: 45 }, // green
  { h: 180, s: 90, l: 47 }, // cyan
] as const

export const CD_PALETTES = {
  seaMist: {
    meta: { label: 'Fresh', hint: 'Aquamarine through bright sky blue' },
    sourceColors: SEA_MIST_SOURCE,
    // Brighter, more saturated sky-azure — the old 64%-sat steel blue read as
    // dull on the white light-mode chrome (logo + active nav) vs the other,
    // punchier palettes. This is the light-mode chrome accent for Fresh.
    primary: { h: 208, s: 92, l: 54 },
  },
  aurora: {
    meta: { label: 'Aurora', hint: 'Neon pink → ultrasonic blue → sky aqua' },
    sourceColors: AURORA_SOURCE,
    primary: { h: 230, s: 83, l: 55 },
  },
  neutral: {
    meta: { label: 'Neutral', hint: 'Sky aqua → yale-blue, calm cool ramp' },
    sourceColors: NEUTRAL_SOURCE,
    primary: { h: 196, s: 100, l: 50 },
  },
  highContrast: {
    meta: { label: 'High Contrast', hint: 'Bold, vivid, maximum pop' },
    sourceColors: HIGH_CONTRAST_SOURCE,
    primary: { h: 222, s: 95, l: 50 },
  },
} as const satisfies Record<string, PaletteDef>

export type CdPaletteId = keyof typeof CD_PALETTES
export const CD_PALETTE_IDS: readonly CdPaletteId[] = ['seaMist', 'aurora', 'neutral', 'highContrast']

export function resolvePaletteId(raw: unknown): CdPaletteId {
  if (typeof raw !== 'string') return 'seaMist'
  return (CD_PALETTE_IDS as readonly string[]).includes(raw)
    ? (raw as CdPaletteId)
    : 'seaMist'
}

/**
 * Spread `count` indices across a `sourceLen`-long list with a constant
 * step. For a 10-colour source + 4 stops → indices `[0, 3, 6, 9]`. Same
 * helper Earnest's AppRail uses for chip picks (`pickGappy`); kept local
 * so this file has no cross-repo dependency.
 */
function pickGappy(sourceLen: number, count: number): number[] {
  if (count <= 1) return [0]
  if (count >= sourceLen) {
    return Array.from({ length: count }, (_, i) => Math.min(i, sourceLen - 1))
  }
  const step = (sourceLen - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(i * step))
}

/**
 * Write the active palette's 4 tint stops + primary accent to `<html>`
 * as CSS custom properties. Idempotent + client-only — server-rendered
 * markup keeps whatever SSR fallback values the CSS declares.
 */
export function applyCdPaletteToDocument(paletteId: CdPaletteId): void {
  if (typeof document === 'undefined') return
  const palette = CD_PALETTES[paletteId] ?? CD_PALETTES.seaMist
  const root = document.documentElement
  const picks = pickGappy(palette.sourceColors.length, 4)
  picks.forEach((idx, i) => {
    const c = palette.sourceColors[idx]!
    root.style.setProperty(`--cd-tint-${i + 1}-h`, String(c.h))
    root.style.setProperty(`--cd-tint-${i + 1}-s`, `${c.s}%`)
    root.style.setProperty(`--cd-tint-${i + 1}-l`, `${c.l}%`)
  })
  const p = palette.primary ?? palette.sourceColors[0]!
  root.style.setProperty('--cd-palette-primary', `hsl(${p.h} ${p.s}% ${p.l}%)`)
  root.setAttribute('data-palette', paletteId)
}
