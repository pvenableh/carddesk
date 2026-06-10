<script setup lang="ts">
import { RATINGS, INDUSTRIES } from '~/composables/useConstants'
import { SOCIALS, SOCIAL_KEYS } from '~/types/socials'
import confettiLib from 'canvas-confetti'

const { contacts, createContact, logActivity } = useContacts()
const { state: xp, earn } = useXp()
const { scanning, scanStep, error: scanError, captureFront, captureBackAndScan, scanFrontOnly, reset: resetScan } = useCardScan()
const { nav, goDetail } = useNavigation()
const { error: showError } = useToast()
const eventMode = useEventMode()

// In Event Mode, pre-fill "Where We Met" with the event name so the user sees
// the auto-tag (the save also enforces it regardless of the field).
onMounted(() => {
  if (eventMode.active.value && !addForm.value.metAt) addForm.value.metAt = eventMode.name.value
})

const addForm = ref<Record<string, any>>({
  firstName: '', lastName: '', title: '', company: '',
  email: '', phone: '', industry: '', metAt: '', rating: '', notes: '',
  ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, ''])),
})
const wasScanned = ref(false)

const addName = computed(() =>
  [addForm.value.firstName, addForm.value.lastName].filter(Boolean).join(' ')
)

function fireConfetti() {
  confettiLib({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#00ff87', '#ffd700', '#ff6b35', '#4da6ff', '#b87dff'] })
}

function applyResult(result: any) {
  addForm.value = {
    firstName: result.first_name ?? '',
    lastName: result.last_name ?? '',
    title: result.title ?? '',
    company: result.company ?? '',
    email: result.email ?? '',
    phone: result.phone ?? '',
    industry: result.industry ?? '',
    metAt: addForm.value.metAt,
    rating: '',
    notes: [result.website, result.address].filter(Boolean).join('\n'),
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, result[k] ?? ''])),
  }
  wasScanned.value = true
  earn(50, '📷', 'Card scanned!', { total_scans: (xp.value.total_scans ?? 0) + 1 })
  useFeed().emit('card_scanned', { company: result.company || null })
  fireConfetti()
}

async function doScanFront() {
  try {
    await captureFront()
  } catch (err: any) {
    // 'Cancelled' = user backed out of the camera/picker; stay silent.
    // Anything else (photo failed to decode, etc.) used to fail silently and
    // leave the user staring at the idle screen — now we tell them.
    if (err?.message !== 'Cancelled') {
      console.error('[scan]', err)
      showError(err?.message || 'Oops — something went wrong reading that photo. Try again.')
    }
  }
}

async function doScanBack() {
  try {
    const result = await captureBackAndScan()
    applyResult(result)
  } catch (err: any) {
    if (err?.message !== 'Cancelled') {
      console.error('[scan]', err)
      showError(err?.message || 'Oops — the scan didn\'t go through. Try again.')
    }
  }
}

async function doSkipBack() {
  try {
    const result = await scanFrontOnly()
    applyResult(result)
  } catch (err: any) {
    if (err?.message !== 'Cancelled') {
      console.error('[scan]', err)
      showError(err?.message || 'Oops — the scan didn\'t go through. Try again.')
    }
  }
}

const saving = ref(false)

async function doSaveContact() {
  if (!addName.value || saving.value) return
  saving.value = true
  let contact: any
  try {
    contact = await createContact({
      name: addName.value,
      first_name: addForm.value.firstName || undefined,
      last_name: addForm.value.lastName || undefined,
      title: addForm.value.title || undefined,
      company: addForm.value.company || undefined,
      email: addForm.value.email || undefined,
      phone: addForm.value.phone || undefined,
      industry: addForm.value.industry || undefined,
      ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, addForm.value[k] || undefined])),
      met_at: (eventMode.active.value ? eventMode.name.value : addForm.value.metAt) || undefined,
      rating: (addForm.value.rating as any) || undefined,
      notes: addForm.value.notes || undefined,
    })
  } catch (err: any) {
    console.error('[AddContact] Failed to save contact:', err?.data?.message ?? err)
    showError(err?.data?.message || 'Couldn\'t save this contact — try again.')
    saving.value = false
    return
  }
  if (wasScanned.value) {
    try {
      await logActivity({
        contact: contact.id,
        type: 'card_scanned',
        label: 'Card Scanned',
        date: new Date().toISOString().slice(0, 10),
        note: contact.company ? `Scanned card from ${contact.company}` : null,
      } as any)
    } catch (err: any) {
      console.error('[AddContact] Failed to log card_scanned activity:', err?.data?.message ?? err)
    }
    // Notify the user's OTHER devices about the new scan. Fire-and-forget —
    // a failure here shouldn't break the save flow.
    $fetch('/api/cd/scan-notify', {
      method: 'POST',
      body: {
        contact_id: contact.id,
        contact_name: contact.name,
        contact_company: contact.company || null,
      },
    }).catch((err: any) => {
      console.warn('[AddContact] scan-notify failed:', err?.data?.message ?? err)
    })
  }
  earn(25, '💾', "They're in your network.", { total_contacts: contacts.value.length })
  addForm.value = {
    firstName: '', lastName: '', title: '', company: '',
    email: '', phone: '', industry: '', metAt: '', rating: '', notes: '',
  }
  wasScanned.value = false
  resetScan()
  saving.value = false
  // In Event Mode, loop straight back for the next card; otherwise open the detail.
  if (eventMode.active.value) {
    addForm.value.metAt = eventMode.name.value
    nav('event')
  } else {
    goDetail(contact.id)
  }
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr">
      <div class="cd-stitle">Add Contact</div>
    </div>
    <div class="cd-scrl cd-pad">
      <!-- Scan Zone: Idle state -->
      <div v-if="scanStep === 'idle' && !scanning" class="cd-scan-zone" @click="doScanFront">
        <div style="font-size: 44px; margin-bottom: 8px"><CdIcon emoji="📷" icon="lucide:camera" :size="44" /></div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 2px">
          Scan Business Card
        </div>
        <div style="font-size: 11px; font-weight: 700; color: var(--cd-accent); margin-bottom: 4px">
          <CdIcon icon="lucide:hand-pointer" :size="11" /> Tap to Scan Business Card
        </div>
        <div style="font-size: 11px; color: var(--cd-dim)">
          Earnest AI reads both sides — name, email, phone, company
        </div>
        <span class="cd-xpb" style="margin-top: 9px; display: inline-block">+50 XP</span>
      </div>

      <!-- Scan Zone: Front captured, prompt for back -->
      <div v-else-if="scanStep === 'captured-front'" class="cd-scan-captured">
        <div style="font-size: 36px; margin-bottom: 6px"><CdIcon emoji="✅" icon="lucide:check-circle" :size="36" /></div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 4px">
          Front Captured
        </div>
        <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 14px">
          Flip the card to scan the back, or skip if single-sided
        </div>
        <div style="display: flex; gap: 8px">
          <button class="cd-abtn g" style="font-size: 13px; padding: 10px" @click="doScanBack">
            <CdIcon emoji="📷" icon="lucide:camera" :size="14" /> Scan Back
          </button>
          <button class="cd-abtn b" style="font-size: 13px; padding: 10px" @click="doSkipBack">
            Skip →
          </button>
        </div>
      </div>

      <!-- Scan Zone: Processing -->
      <div v-else class="cd-scan-zone" style="pointer-events: none">
        <div class="cd-spin" style="font-size: 44px; line-height: 1"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="44" /></div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 4px">
          Reading card...
        </div>
        <div style="font-size: 11px; color: var(--cd-dim)">
          Earnest AI is extracting the details
        </div>
      </div>

      <div
        v-if="scanError"
        style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 10px 13px; margin-top: 8px; margin-bottom: 10px; font-size: 12px; color: #ef4444"
      >{{ scanError }}</div>
      <div style="display: flex; align-items: center; gap: 10px; color: var(--cd-dim); font-size: 10px; margin: 12px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700">
        <div style="flex: 1; height: 1px; background: var(--cd-bdr)"></div>
        or enter manually
        <div style="flex: 1; height: 1px; background: var(--cd-bdr)"></div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
        <div>
          <label class="cd-lbl">First Name</label>
          <input v-model="addForm.firstName" class="cd-inp" placeholder="Jane" />
        </div>
        <div>
          <label class="cd-lbl">Last Name</label>
          <input v-model="addForm.lastName" class="cd-inp" placeholder="Smith" />
        </div>
      </div>
      <label class="cd-lbl">Title</label><input v-model="addForm.title" class="cd-inp" placeholder="VP Product" />
      <label class="cd-lbl">Company</label><input v-model="addForm.company" class="cd-inp" placeholder="Acme Corp" />
      <label class="cd-lbl">Email</label><input v-model="addForm.email" class="cd-inp" type="email" placeholder="jane@acme.com" />
      <label class="cd-lbl">Phone</label><input v-model="addForm.phone" class="cd-inp" type="tel" placeholder="+1 555 000 0000" />
      <template v-for="s in SOCIALS" :key="s.key">
        <label class="cd-lbl">{{ s.label }}</label><input v-model="addForm[s.key]" class="cd-inp" :placeholder="s.placeholder" />
      </template>
      <label class="cd-lbl">Where We Met</label><input v-model="addForm.metAt" class="cd-inp" placeholder="SaaS Summit NYC" />
      <label class="cd-lbl">Industry</label>
      <select v-model="addForm.industry" class="cd-inp" style="cursor: pointer">
        <option value="">Select...</option>
        <option v-for="ind in INDUSTRIES" :key="ind" :value="ind">{{ ind }}</option>
      </select>
      <label class="cd-lbl">Rating</label>
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px">
        <button
          v-for="r in RATINGS"
          :key="r.key"
          class="cd-rpick"
          :style="addForm.rating === r.key ? 'background:' + r.color + '22;border-color:' + r.color + ';color:' + r.color : ''"
          @click="addForm.rating = addForm.rating === r.key ? '' : r.key"
        ><CdIcon :emoji="r.emoji" :icon="r.lucide" :size="14" /> {{ r.label }}</button>
      </div>
      <label class="cd-lbl">Notes</label>
      <textarea v-model="addForm.notes" class="cd-inp" style="min-height: 60px; resize: vertical" placeholder="Anything useful..."></textarea>
    </div>
    <div class="cd-save-bar">
      <button
        class="cd-abtn g"
        style="font-size: 16px; padding: 13px"
        :disabled="!addName || saving"
        @click="doSaveContact"
      >{{ saving ? 'Saving…' : 'SAVE + EARN 25 XP →' }}</button>
    </div>
  </div>
</template>
