<script setup lang="ts">
import { RATINGS, INDUSTRIES } from '~/composables/useConstants'
import confettiLib from 'canvas-confetti'

const { contacts, createContact } = useContacts()
const { state: xp, earn } = useXp()
const { scanning, error: scanError, openCamera } = useCardScan()
const { nav, goDetail } = useNavigation()

const addForm = ref({
  firstName: '', lastName: '', title: '', company: '',
  email: '', phone: '', industry: '', metAt: '', rating: '', notes: '',
})

const addName = computed(() =>
  [addForm.value.firstName, addForm.value.lastName].filter(Boolean).join(' ')
)

function fireConfetti() {
  confettiLib({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#00ff87', '#ffd700', '#ff6b35', '#4da6ff', '#b87dff'] })
}

async function doScan() {
  try {
    const result = await openCamera()
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
      notes: [result.website, result.linkedin, result.address].filter(Boolean).join('\n'),
    }
    earn(50, '📷', 'Card scanned!', { total_scans: (xp.value.total_scans ?? 0) + 1 })
    fireConfetti()
  } catch (err: any) {
    if (err?.message !== 'Cancelled') console.error('[scan]', err)
  }
}

async function doSaveContact() {
  if (!addName.value) return
  const contact = await createContact({
    name: addName.value,
    first_name: addForm.value.firstName || undefined,
    last_name: addForm.value.lastName || undefined,
    title: addForm.value.title || undefined,
    company: addForm.value.company || undefined,
    email: addForm.value.email || undefined,
    phone: addForm.value.phone || undefined,
    industry: addForm.value.industry || undefined,
    met_at: addForm.value.metAt || undefined,
    rating: (addForm.value.rating as any) || undefined,
    notes: addForm.value.notes || undefined,
  })
  earn(25, '💾', "They're in your network.", { total_contacts: contacts.value.length })
  addForm.value = {
    firstName: '', lastName: '', title: '', company: '',
    email: '', phone: '', industry: '', metAt: '', rating: '', notes: '',
  }
  goDetail(contact.id)
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr">
      <button class="cd-back" @click="nav('contacts')">← Back</button>
      <div class="cd-stitle">Add Contact</div>
    </div>
    <div class="cd-scrl cd-pad">
      <div class="cd-scan-zone" @click="doScan">
        <div v-if="scanning" style="font-size: 44px; animation: cd-wig 0.6s infinite">⏳</div>
        <div v-else style="font-size: 44px; margin-bottom: 8px">📷</div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: #00ff87; margin-bottom: 4px">
          {{ scanning ? 'Reading card...' : 'Scan Business Card' }}
        </div>
        <div style="font-size: 11px; color: #3e4f68">
          {{ scanning ? 'Claude AI is extracting the details' : 'AI reads name, email, phone, company instantly' }}
        </div>
        <span class="cd-xpb" style="margin-top: 9px; display: inline-block">+50 XP</span>
      </div>
      <div
        v-if="scanError"
        style="background: rgba(255,107,53,0.1); border: 1px solid rgba(255,107,53,0.3); border-radius: 10px; padding: 10px 13px; margin-bottom: 10px; font-size: 12px; color: #ff6b35"
      >{{ scanError }}</div>
      <div style="display: flex; align-items: center; gap: 10px; color: #3e4f68; font-size: 10px; margin: 12px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700">
        <div style="flex: 1; height: 1px; background: #1c2330"></div>
        or enter manually
        <div style="flex: 1; height: 1px; background: #1c2330"></div>
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
        >{{ r.emoji }} {{ r.label }}</button>
      </div>
      <label class="cd-lbl">Notes</label>
      <textarea v-model="addForm.notes" class="cd-inp" style="min-height: 60px; resize: vertical" placeholder="Anything useful..."></textarea>
      <button
        class="cd-abtn g"
        style="font-size: 16px; padding: 13px; margin-top: 4px"
        :disabled="!addName"
        @click="doSaveContact"
      >SAVE + EARN 25 XP →</button>
    </div>
  </div>
</template>
