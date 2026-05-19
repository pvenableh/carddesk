/**
 * Rasterize public/icons/icon.svg + icon-maskable.svg into the PNG set
 * the web-app manifest + iOS need.  Run with `npm run generate-icons`.
 */
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '..', 'public')
const iconsDir = resolve(publicDir, 'icons')

const targets = [
  { src: 'icon.svg',          out: 'icons/icon-192.png',          size: 192 },
  { src: 'icon.svg',          out: 'icons/icon-512.png',          size: 512 },
  { src: 'icon-maskable.svg', out: 'icons/icon-maskable-192.png', size: 192 },
  { src: 'icon-maskable.svg', out: 'icons/icon-maskable-512.png', size: 512 },
  { src: 'icon.svg',          out: 'icons/apple-touch-icon.png',  size: 180 },
  { src: 'icon.svg',          out: 'icons/favicon-32.png',        size: 32  },
  { src: 'icon.svg',          out: 'icons/favicon-16.png',        size: 16  },
  // Root-level fallback iOS Safari probes when <link rel=apple-touch-icon>
  // is missing or its URL doesn't resolve. Same 180px asset, just at /.
  { src: 'icon.svg',          out: 'apple-touch-icon.png',        size: 180 },
]

for (const { src, out, size } of targets) {
  const svg = await readFile(resolve(iconsDir, src))
  const buf = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()
  await writeFile(resolve(publicDir, out), buf)
  console.log(`✓ ${out} (${size}×${size})`)
}
