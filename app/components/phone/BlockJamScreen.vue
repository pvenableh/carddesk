<script setup lang="ts">
/**
 * Picture Jam — a calm Block-Blast-style puzzle modelled on "Picture Block Jam".
 * Drag the three tray pieces onto an 8×8 grid; completing a full row or column
 * "blasts" it clear, and every cleared cell permanently uncovers a slice of the
 * picture hiding behind the board. The picture is a *quiet* contact (14+ days
 * since their last touch, or never touched) — so the relaxing puzzle doubles as
 * a reconnect nudge. Same house rule as Reconnect Roulette: the puzzle itself
 * is free fun, the real XP comes from the follow-up you log once they're
 * uncovered. A small once-a-day completion bonus rewards the skill itself.
 *
 * Recovery, not punishment: running out of moves keeps the picture you've
 * uncovered so far, so a board is always winnable across a couple of tries.
 */
import confetti from 'canvas-confetti'
import { cEmoji, getRating } from '~/composables/useConstants'
import { todayStr } from '~/composables/useFormatters'
import type { CdContact } from '~/types/directus'

const { contacts, followUpStatus, daysSince, logActivity } = useContacts()
const { earn, completeMission } = useXp()
const { nav, goDetail } = useNavigation()
const { error: showError } = useToast()

// ── board geometry ──
const COLS = 8
const ROWS = 8
const N = COLS * ROWS
const WIN_THRESHOLD = 0.72 // picture is plainly readable well before 100%
const TRAY_CELL = 17 // px — tray pieces render mini; the drag ghost uses board scale
const LIFT = 18 // px the floating piece sits above the finger so you can see it

const board = ref<(string | null)[]>(Array(N).fill(null)) // colour per filled cell
const revealed = ref<boolean[]>(Array(N).fill(false)) // picture slice uncovered
const clearing = ref<Set<number>>(new Set()) // cells mid-blast (for the pop anim)
const score = ref(0)
const won = ref(false)
const dead = ref(false)
const logged = ref(false)
const busy = ref(false)
const combo = ref<{ id: number; lines: number } | null>(null)
let comboId = 0

// ── the hidden picture: a quiet contact ──
// Same pool as Reconnect Roulette — worth a serendipitous nudge, but not already
// screaming in Up Next. Contacts with a photo make the nicest reveal, so float
// them to the front of the draw.
const pool = computed(() =>
  contacts.value.filter((c) => {
    if (c.hibernated || followUpStatus(c) === 'overdue') return false
    const d = daysSince(c)
    return d === null || d >= 14
  })
)
const contact = ref<CdContact | null>(null)
const seen = ref<Set<string>>(new Set()) // don't redraw the same face back-to-back

function pickContact(): CdContact | null {
  let candidates = pool.value.filter((c) => !seen.value.has(c.id))
  if (!candidates.length) { seen.value.clear(); candidates = [...pool.value] }
  if (!candidates.length) return null
  const withPhoto = candidates.filter((c) => (c as any).imageUrl)
  const draw = withPhoto.length ? withPhoto : candidates
  const c = draw[Math.floor(Math.random() * draw.length)]
  seen.value.add(c.id)
  return c
}

const imageUrl = computed(() => (contact.value as any)?.imageUrl as string | undefined)
const accent = computed(() => getRating(contact.value?.rating ?? '')?.color ?? 'var(--cd-green)')
const revealCount = computed(() => revealed.value.reduce((n, r) => n + (r ? 1 : 0), 0))
const revealPct = computed(() => Math.round((revealCount.value / N) * 100))
const firstName = computed(() => contact.value?.name?.split(' ')[0] ?? 'them')
function quietLabel(c: CdContact): string {
  const d = daysSince(c)
  return d != null ? `${d} days quiet` : 'never touched'
}

// ── pieces ──
type Cell = [number, number] // [row, col], normalised so the min row/col is 0
interface Piece { id: number; cells: Cell[]; color: string; w: number; h: number }

const SHAPES: Cell[][] = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0]], // corner tromino
  [[0, 0], [0, 1], [1, 0], [1, 1]], // 2×2
  [[0, 0], [0, 1], [0, 2], [0, 3]], // I4 horizontal
  [[0, 0], [1, 0], [2, 0], [3, 0]], // I4 vertical
  [[0, 0], [1, 0], [2, 0], [2, 1]], // L
  [[0, 1], [1, 1], [2, 1], [2, 0]], // J
  [[0, 0], [0, 1], [0, 2], [1, 1]], // T
  [[0, 1], [0, 2], [1, 0], [1, 1]], // S
  [[0, 0], [0, 1], [1, 1], [1, 2]], // Z
]
const PALETTE = ['#00ff87', '#4da6ff', '#ffd700', '#ff6b35', '#b87dff', '#00c268', '#ff5e9c']

let pieceId = 0
function gen(): Piece {
  const cells = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]
  let w = 0, h = 0
  for (const [r, c] of cells) { if (c + 1 > w) w = c + 1; if (r + 1 > h) h = r + 1 }
  return { id: ++pieceId, cells, color, w, h }
}
const tray = ref<(Piece | null)[]>([null, null, null])
function refillTray() { tray.value = [gen(), gen(), gen()] }

// ── placement maths ──
function canPlaceAt(p: Piece, row: number, col: number): boolean {
  if (!Number.isFinite(row) || !Number.isFinite(col)) return false
  for (const [dr, dc] of p.cells) {
    const r = row + dr, c = col + dc
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false
    if (board.value[r * COLS + c]) return false
  }
  return true
}
function anyPlacement(p: Piece): boolean {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (canPlaceAt(p, r, c)) return true
  return false
}
function hasAnyMove(): boolean { return tray.value.some((p) => p && anyPlacement(p)) }

// ── drag ──
const boardEl = ref<HTMLElement | null>(null)
const dragging = ref<Piece | null>(null)
const dragSlot = ref(-1)
const ghost = reactive({ x: 0, y: 0 })
const preview = ref<number[]>([])
const previewValid = ref(false)
const previewSet = computed(() => (previewValid.value ? new Set(preview.value) : new Set<number>()))
let dragRect: DOMRect | null = null
let cellPx = 0
let dropRow = NaN
let dropCol = NaN

function onPointerDown(e: PointerEvent, p: Piece | null, slot: number) {
  if (!p || dragging.value || won.value || dead.value || !boardEl.value) return
  e.preventDefault()
  dragRect = boardEl.value.getBoundingClientRect()
  cellPx = dragRect.width / COLS
  dragging.value = p
  dragSlot.value = slot
  moveGhost(e.clientX, e.clientY)
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
}

function moveGhost(px: number, py: number) {
  const p = dragging.value
  if (!p || !dragRect) return
  // Float the piece centred horizontally on the finger and lifted above it.
  ghost.x = px - (p.w * cellPx) / 2
  ghost.y = py - p.h * cellPx - LIFT
  dropCol = Math.round((ghost.x - dragRect.left) / cellPx)
  dropRow = Math.round((ghost.y - dragRect.top) / cellPx)
  if (canPlaceAt(p, dropRow, dropCol)) {
    preview.value = p.cells.map(([dr, dc]) => (dropRow + dr) * COLS + (dropCol + dc))
    previewValid.value = true
  } else {
    preview.value = []
    previewValid.value = false
  }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  e.preventDefault()
  moveGhost(e.clientX, e.clientY)
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  const p = dragging.value
  const slot = dragSlot.value
  const place = previewValid.value
  dragging.value = null
  dragSlot.value = -1
  preview.value = []
  previewValid.value = false
  if (p && place) placePiece(p, slot, dropRow, dropCol)
}

function placePiece(p: Piece, slot: number, row: number, col: number) {
  for (const [dr, dc] of p.cells) board.value[(row + dr) * COLS + (col + dc)] = p.color
  tray.value[slot] = null
  if (import.meta.client) navigator.vibrate?.(14)
  clearLines()
  if (tray.value.every((t) => !t)) refillTray()
  if (!won.value && !hasAnyMove()) dead.value = true
}

function clearLines() {
  const hits = new Set<number>()
  let lines = 0
  for (let r = 0; r < ROWS; r++) {
    let full = true
    for (let c = 0; c < COLS; c++) if (!board.value[r * COLS + c]) { full = false; break }
    if (full) { lines++; for (let c = 0; c < COLS; c++) hits.add(r * COLS + c) }
  }
  for (let c = 0; c < COLS; c++) {
    let full = true
    for (let r = 0; r < ROWS; r++) if (!board.value[r * COLS + c]) { full = false; break }
    if (full) { lines++; for (let r = 0; r < ROWS; r++) hits.add(r * COLS + c) }
  }
  if (!lines) return

  score.value += 10 * lines * lines // 1→10, 2→40, 3→90 — combos pay
  if (lines > 1) {
    combo.value = { id: ++comboId, lines }
    const id = comboId
    setTimeout(() => { if (combo.value?.id === id) combo.value = null }, 900)
  }

  clearing.value = new Set([...clearing.value, ...hits])
  if (import.meta.client) {
    navigator.vibrate?.(lines > 1 ? [16, 24, 36] : 18)
    const rect = boardEl.value?.getBoundingClientRect()
    if (rect) confetti({
      particleCount: 28 + lines * 18,
      spread: 55 + lines * 10,
      startVelocity: 32,
      origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
      colors: ['#ffd700', '#00ff87', '#4da6ff', '#ffffff'],
    })
  }

  // Let the blast animation play, then drop the blocks and uncover the picture.
  setTimeout(() => {
    for (const idx of hits) { board.value[idx] = null; revealed.value[idx] = true; clearing.value.delete(idx) }
    clearing.value = new Set(clearing.value)
    checkWin()
  }, 200)
}

function checkWin() {
  if (won.value) return
  if (revealCount.value / N >= WIN_THRESHOLD) winRound()
}

const DONE_KEY = 'cd-jam-done' // once-a-day completion bonus, like roulette spins

function winRound() {
  won.value = true
  // Flourish: uncover whatever's left of the picture.
  revealed.value = revealed.value.map(() => true)
  if (import.meta.client) {
    navigator.vibrate?.([26, 36, 26, 36, 60])
    confetti({ particleCount: 160, spread: 115, startVelocity: 46, origin: { y: 0.5 }, colors: ['#ffd700', '#00ff87', '#4da6ff', '#ff6b35', '#ffffff'] })
    try {
      if (localStorage.getItem(DONE_KEY) !== todayStr()) {
        localStorage.setItem(DONE_KEY, todayStr())
        earn(10, '🧩', 'Picture Jam complete — nicely played!')
      }
    } catch { /* quota / private mode */ }
  }
}

// ── reconnect — the real reward (mirrors Reconnect Roulette) ──
async function logTouch() {
  const c = contact.value
  if (!c || busy.value || logged.value) return
  busy.value = true
  try {
    await logActivity({ contact: c.id, type: 'other', label: 'Picture Jam reconnect', date: todayStr(), is_response: false })
    if (c.rating === 'hot') { earn(50, '🧩', `Uncovered & reached ${firstName.value}!`); completeMission('hot') }
    else earn(25, '🧩', `Uncovered & reached ${firstName.value}!`)
    completeMission('followup')
    logged.value = true
  } catch { showError("Couldn't log that — try again.") }
  finally { busy.value = false }
}

// ── round lifecycle ──
function resetBoard() {
  board.value = Array(N).fill(null)
  clearing.value = new Set()
  score.value = 0
  won.value = false
  dead.value = false
  refillTray()
}
function retry() { resetBoard() /* keep the picture uncovered so far */ }
function newContact() {
  const next = pickContact()
  if (!next) return
  contact.value = next
  logged.value = false
  revealed.value = Array(N).fill(false)
  resetBoard()
}

onMounted(() => { if (!contact.value) newContact() })
onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div class="cd-screen on bj">
    <div class="cd-shdr">
      <button class="cd-back" @click="nav('vibe')"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Back</button>
      <div class="cd-stitle">Picture Jam <CdIcon emoji="🧩" icon="lucide:puzzle" :size="16" /></div>
    </div>

    <!-- No one quiet enough to hide behind the board yet -->
    <div v-if="!contact" class="bj-locked">
      <div class="bj-locked-ico"><CdIcon emoji="🧩" icon="lucide:puzzle" :size="44" /></div>
      <div class="bj-locked-title">Nobody to uncover yet</div>
      <p class="bj-locked-sub">Picture Jam hides a contact who's gone quiet behind the blocks. Scan a few cards — once people go quiet, they'll show up here.</p>
      <button class="cd-abtn g" @click="nav('add')"><CdIcon emoji="📷" icon="lucide:scan" :size="14" /> Scan a card</button>
    </div>

    <div v-else class="bj-body">
      <!-- HUD: the mystery + how far you've uncovered it -->
      <div class="bj-hud">
        <div class="bj-hud-row">
          <span class="bj-hud-lbl">
            <CdIcon emoji="🫥" icon="lucide:eye-off" :size="12" />
            {{ won ? 'Uncovered!' : 'Someone quiet is hiding behind the blocks' }}
          </span>
          <span class="bj-hud-score">{{ score.toLocaleString() }}</span>
        </div>
        <div class="bj-bar"><div class="bj-bar-fill" :style="{ width: revealPct + '%' }"></div></div>
        <div class="bj-hud-pct">{{ revealPct }}% revealed · clear rows &amp; columns to uncover them</div>
      </div>

      <!-- board -->
      <div class="bj-stage">
        <div ref="boardEl" class="bj-board" :style="{ '--accent': accent }">
          <!-- the picture behind the grid -->
          <div class="bj-pic">
            <img v-if="imageUrl" :src="imageUrl" alt="" class="bj-pic-img" :class="{ done: won }" />
            <div v-else class="bj-pic-fallback" :style="{ opacity: 0.25 + 0.75 * (revealCount / N) }">
              <CdIcon :emoji="cEmoji(contact)" icon="lucide:user" :size="84" />
            </div>
          </div>

          <!-- the 8×8 cover grid -->
          <div class="bj-grid">
            <div
              v-for="(_, idx) in N"
              :key="idx"
              class="bj-cell"
              :class="{
                filled: !!board[idx],
                cover: !board[idx] && !revealed[idx],
                open: !board[idx] && revealed[idx],
                preview: previewSet.has(idx),
                clearing: clearing.has(idx),
              }"
              :style="board[idx] ? { '--bc': board[idx] } : undefined"
            ></div>
          </div>

          <!-- combo shout -->
          <Transition name="bj-combo">
            <div v-if="combo" :key="combo.id" class="bj-comboPop">{{ combo.lines }}× blast!</div>
          </Transition>
        </div>
      </div>

      <!-- tray -->
      <div class="bj-tray">
        <div
          v-for="(p, slot) in tray"
          :key="slot"
          class="bj-slot"
          :class="{ empty: !p, grabbed: dragging && dragSlot === slot }"
        >
          <div
            v-if="p"
            class="bj-piece"
            :style="{ width: p.w * TRAY_CELL + 'px', height: p.h * TRAY_CELL + 'px' }"
            @pointerdown="onPointerDown($event, p, slot)"
          >
            <div
              v-for="(c, ci) in p.cells"
              :key="ci"
              class="bj-pc"
              :style="{ left: c[1] * TRAY_CELL + 'px', top: c[0] * TRAY_CELL + 'px', width: TRAY_CELL + 'px', height: TRAY_CELL + 'px', '--bc': p.color }"
            ></div>
          </div>
        </div>
      </div>
      <div class="bj-hint">Drag a piece onto the board · fill a row or column to blast it</div>
    </div>

    <!-- floating drag ghost -->
    <div
      v-if="dragging"
      class="bj-ghost"
      :class="{ bad: !previewValid }"
      :style="{ left: ghost.x + 'px', top: ghost.y + 'px', width: dragging.w * cellPx + 'px', height: dragging.h * cellPx + 'px' }"
    >
      <div
        v-for="(c, ci) in dragging.cells"
        :key="ci"
        class="bj-pc"
        :style="{ left: c[1] * cellPx + 'px', top: c[0] * cellPx + 'px', width: cellPx + 'px', height: cellPx + 'px', '--bc': dragging.color }"
      ></div>
    </div>

    <!-- WIN: the reveal + the real reason we're here -->
    <Transition name="bj-ov">
      <div v-if="won && contact" class="bj-ov">
        <div class="bj-card">
          <div class="bj-card-eyebrow"><CdIcon emoji="🎉" icon="lucide:party-popper" :size="13" /> Picture complete</div>
          <button class="bj-reveal" type="button" @click="goDetail(contact.id)">
            <span class="bj-reveal-av" :style="{ '--accent': accent }">
              <img v-if="imageUrl" :src="imageUrl" alt="" />
              <CdIcon v-else :emoji="cEmoji(contact)" icon="lucide:user" :size="26" />
            </span>
            <span class="bj-reveal-info">
              <span class="bj-reveal-name">{{ contact.name }}</span>
              <span class="bj-reveal-sub">{{ [contact.title, contact.company].filter(Boolean).join(' · ') || quietLabel(contact) }}</span>
              <span class="bj-reveal-quiet">{{ quietLabel(contact) }}</span>
            </span>
          </button>
          <p class="bj-card-nudge">You just uncovered {{ firstName }} — they've gone quiet. Reach out while they're top of mind.</p>
          <div class="bj-acts">
            <a v-if="contact.phone" class="bj-act" :href="`sms:${contact.phone}`"><CdIcon emoji="📱" icon="lucide:message-circle" :size="14" /> Text</a>
            <a v-if="contact.email" class="bj-act" :href="`mailto:${contact.email}`"><CdIcon emoji="📧" icon="lucide:mail" :size="14" /> Email</a>
            <button class="bj-act log" type="button" :disabled="busy || logged" @click="logTouch">
              <CdIcon :emoji="logged ? '✅' : '✓'" :icon="logged ? 'lucide:check-circle' : 'lucide:check'" :size="14" />
              {{ logged ? 'Logged!' : `Log touch +${contact.rating === 'hot' ? 50 : 25}` }}
            </button>
          </div>
          <button class="bj-again" type="button" @click="newContact"><CdIcon icon="lucide:refresh-cw" :size="13" /> Uncover someone new</button>
        </div>
      </div>
    </Transition>

    <!-- OUT OF MOVES -->
    <Transition name="bj-ov">
      <div v-if="dead" class="bj-ov">
        <div class="bj-card">
          <div class="bj-card-eyebrow dim"><CdIcon emoji="🚧" icon="lucide:hand" :size="13" /> Out of moves</div>
          <div class="bj-dead-big">{{ revealPct }}%</div>
          <p class="bj-card-nudge">No room for the next pieces — but the {{ revealPct }}% you've uncovered stays. Pick up where you left off.</p>
          <div class="bj-acts">
            <button class="bj-act log" type="button" @click="retry"><CdIcon icon="lucide:rotate-ccw" :size="14" /> Keep uncovering</button>
            <button class="bj-act" type="button" @click="newContact"><CdIcon icon="lucide:refresh-cw" :size="14" /> Someone new</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bj { display: flex; flex-direction: column; }
.bj-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 10px var(--cd-gutter, 16px) max(16px, env(safe-area-inset-bottom)); }

/* ── HUD ── */
.bj-hud { flex-shrink: 0; }
.bj-hud-row { display: flex; align-items: center; gap: 8px; }
.bj-hud-lbl { display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: var(--cd-muted); }
.bj-hud-score {
  margin-left: auto; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.5px;
  color: var(--cd-gold, #ffd700);
}
.bj-bar { margin-top: 7px; height: 6px; border-radius: 999px; background: var(--cd-bdr); overflow: hidden; }
.bj-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--cd-green), var(--cd-gold, #ffd700)); transition: width 0.4s ease; }
.bj-hud-pct { margin-top: 5px; font-size: 9.5px; font-weight: 600; color: var(--cd-dim); }

/* ── stage / board ── */
.bj-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.bj-board {
  position: relative;
  width: min(92vw, 60vh, 440px);
  aspect-ratio: 1;
  border-radius: 18px;
  overflow: hidden;
  background: var(--cd-bg2);
  box-shadow: var(--glass-inset), 0 18px 44px -20px rgba(0, 0, 0, 0.6);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--cd-bdr));
  touch-action: none;
  user-select: none; -webkit-user-select: none;
}
.bj-pic { position: absolute; inset: 0; }
.bj-pic-img { width: 100%; height: 100%; object-fit: cover; filter: saturate(1.05); transition: filter 0.5s ease; }
.bj-pic-img.done { filter: saturate(1.15) brightness(1.04); }
.bj-pic-fallback {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: color-mix(in srgb, var(--accent) 80%, white);
  background: radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%),
    linear-gradient(150deg, color-mix(in srgb, var(--accent) 30%, var(--cd-bg2)), var(--cd-bg2));
  transition: opacity 0.4s ease;
}

.bj-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); }
.bj-cell { position: relative; transition: background 0.18s ease, opacity 0.2s ease, transform 0.18s ease; }
/* unrevealed cover — frosted glass that hides the picture, faint grid lines */
.bj-cell.cover {
  background: rgba(14, 16, 22, 0.82);
  backdrop-filter: blur(2px);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.05);
}
/* uncovered, empty — picture shows straight through */
.bj-cell.open { background: transparent; box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.04); }
/* a placed block — glossy candy tile over whatever's beneath */
.bj-cell.filled {
  background: linear-gradient(160deg, color-mix(in srgb, var(--bc) 92%, white) 0%, var(--bc) 45%, color-mix(in srgb, var(--bc) 78%, black) 100%);
  box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, 0.45), inset 0 -2px 3px rgba(0, 0, 0, 0.28), 0 0 0 0.5px rgba(0, 0, 0, 0.25);
  border-radius: 4px;
}
/* valid drop preview */
.bj-cell.preview { background: color-mix(in srgb, var(--accent) 42%, transparent); box-shadow: inset 0 0 0 1px var(--accent); border-radius: 4px; }
/* blast! */
.bj-cell.clearing { animation: bj-blast 0.22s ease forwards; z-index: 2; }
@keyframes bj-blast {
  0% { transform: scale(1); filter: brightness(1); }
  45% { transform: scale(1.18); filter: brightness(2.2); }
  100% { transform: scale(0.2); opacity: 0; filter: brightness(2.6); }
}

.bj-comboPop {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-family: 'Bebas Neue', sans-serif; font-size: 34px; letter-spacing: 1px; z-index: 3;
  color: var(--cd-gold, #ffd700); text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7); pointer-events: none;
}
.bj-combo-enter-active { animation: bj-combo-in 0.3s ease; }
.bj-combo-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.bj-combo-leave-to { opacity: 0; transform: translate(-50%, -120%) scale(1.2); }
@keyframes bj-combo-in { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); } 60% { transform: translate(-50%, -50%) scale(1.18); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

/* ── tray ── */
.bj-tray { flex-shrink: 0; display: flex; align-items: center; justify-content: space-around; gap: 8px; min-height: 78px; }
.bj-slot {
  flex: 1; min-height: 72px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
  transition: border-color 0.18s ease, opacity 0.18s ease, transform 0.12s ease;
}
.bj-slot.empty { opacity: 0.4; border-style: dashed; }
.bj-slot.grabbed { opacity: 0.3; transform: scale(0.96); }
.bj-piece { position: relative; cursor: grab; touch-action: none; }
.bj-piece:active { cursor: grabbing; }
.bj-pc {
  position: absolute; border-radius: 4px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--bc) 92%, white) 0%, var(--bc) 45%, color-mix(in srgb, var(--bc) 78%, black) 100%);
  box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, 0.45), inset 0 -2px 3px rgba(0, 0, 0, 0.28);
}
.bj-hint { flex-shrink: 0; text-align: center; font-size: 10px; font-weight: 600; color: var(--cd-dim); }

/* ── floating drag ghost ── */
.bj-ghost { position: fixed; z-index: 1000; pointer-events: none; filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.5)); transition: opacity 0.1s ease; }
.bj-ghost.bad { opacity: 0.55; }
.bj-ghost .bj-pc { border-radius: 5px; }

/* ── overlays (win / dead) ── */
.bj-ov {
  position: absolute; inset: 0; z-index: 80;
  display: flex; align-items: center; justify-content: center; padding: 24px;
  background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(6px);
}
.bj-card {
  width: min(360px, 92vw); padding: 20px; border-radius: 22px; text-align: center;
  background: var(--cd-bg); border: 1px solid var(--cd-bdr);
  box-shadow: 0 30px 70px -20px rgba(0, 0, 0, 0.7);
}
.bj-card-eyebrow {
  display: inline-flex; align-items: center; gap: 5px; margin-bottom: 14px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--cd-green);
}
.bj-card-eyebrow.dim { color: var(--cd-dim); }
.bj-reveal {
  display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 16px; padding: 12px; cursor: pointer;
  font-family: inherit; color: inherit;
}
.bj-reveal-av {
  width: 52px; height: 52px; flex-shrink: 0; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--accent) 16%, var(--cd-bg)); border: 2px solid var(--accent);
  color: var(--accent);
}
.bj-reveal-av img { width: 100%; height: 100%; object-fit: cover; }
.bj-reveal-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bj-reveal-name { font-size: 17px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bj-reveal-sub { font-size: 11.5px; color: var(--cd-muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bj-reveal-quiet { font-size: 10px; color: var(--cd-gold, #ffd700); font-weight: 700; margin-top: 1px; }
.bj-card-nudge { font-size: 12.5px; line-height: 1.5; color: var(--cd-muted); margin: 14px 0; }
.bj-dead-big { font-family: 'Bebas Neue', sans-serif; font-size: 56px; line-height: 1; color: var(--cd-green); margin: 6px 0; }

.bj-acts { display: flex; gap: 7px; justify-content: center; flex-wrap: wrap; }
.bj-act {
  display: inline-flex; align-items: center; gap: 5px; padding: 9px 14px; border-radius: 9999px; cursor: pointer; text-decoration: none;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-muted);
  font-family: inherit; font-size: 12px; font-weight: 800;
  transition: transform 0.1s ease, border-color 0.15s ease, color 0.15s ease;
}
.bj-act:active { transform: scale(0.95); }
.bj-act.log { color: var(--cd-accent); border-color: color-mix(in srgb, var(--cd-accent) 35%, transparent); background: color-mix(in srgb, var(--cd-accent) 10%, transparent); }
.bj-act:disabled { opacity: 0.6; cursor: default; }
.bj-again {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; background: none; border: none; cursor: pointer;
  color: var(--cd-dim); font-family: inherit; font-size: 11.5px; font-weight: 700;
}
.bj-again:hover { color: var(--cd-text); }

.bj-ov-enter-active, .bj-ov-leave-active { transition: opacity 0.25s ease; }
.bj-ov-enter-active .bj-card { transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1); }
.bj-ov-enter-from, .bj-ov-leave-to { opacity: 0; }
.bj-ov-enter-from .bj-card { transform: scale(0.85) translateY(20px); }

/* ── locked ── */
.bj-locked { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; }
.bj-locked-ico { color: var(--cd-dim); }
.bj-locked-title { font-size: 19px; font-weight: 800; }
.bj-locked-sub { font-size: 12.5px; color: var(--cd-muted); line-height: 1.55; max-width: 280px; margin: 0 0 6px; }
</style>
