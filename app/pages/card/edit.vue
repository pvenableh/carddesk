<script setup lang="ts">
import { SOCIALS, SOCIAL_KEYS } from '~/types/socials'

definePageMeta({ middleware: 'auth', layout: false })

useSeoMeta({
  title: 'Edit Your Card · CardDesk',
  description: 'Customize your shareable CardDesk digital business card — photo, title, company, links and QR code.',
  robots: 'noindex, nofollow',
})

const router = useRouter()
const { success, error: showError } = useToast()

const { data: card } = await useFetch<any>('/api/cards/me')

const form = reactive<Record<string, any>>({
  display_name: '', title: '', company: '', headline: '',
  email: '', phone: '', website: '', broadcast_activity: true,
  ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, ''])),
})
const imageUrl = ref<string | null>(null)

watchEffect(() => {
  if (!card.value) return
  form.display_name = card.value.display_name ?? ''
  form.title = card.value.title ?? ''
  form.company = card.value.company ?? ''
  form.headline = card.value.headline ?? ''
  form.email = card.value.email ?? ''
  form.phone = card.value.phone ?? ''
  form.website = card.value.website ?? ''
  for (const k of SOCIAL_KEYS) form[k] = card.value[k] ?? ''
  form.broadcast_activity = card.value.broadcast_activity ?? true
  imageUrl.value = card.value.imageUrl ?? null
})

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch('/api/cards/me', { method: 'PATCH', body: { ...form } })
    success('Card saved')
    router.push('/')
  } catch {
    showError('Could not save card')
  } finally {
    saving.value = false
  }
}

const uploading = ref(false)
const fileEl = ref<HTMLInputElement | null>(null)
async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', f)
    const r = await $fetch<{ imageUrl: string }>('/api/cards/image', { method: 'POST', body: fd })
    imageUrl.value = r.imageUrl
    success('Photo updated')
  } catch {
    showError('Upload failed (max 5MB)')
  } finally {
    uploading.value = false
  }
}

const initials = computed(() =>
  (form.display_name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
)
</script>

<template>
  <div class="ce">
    <div class="ce-bar">
      <button class="cd-back" @click="router.push('/')"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Done</button>
      <div class="ce-title">My Card</div>
      <div style="width: 48px" />
    </div>

    <div class="ce-body">
      <!-- Photo -->
      <div class="ce-photo">
        <div class="ce-photo-img">
          <img v-if="imageUrl" :src="imageUrl" alt="Card photo" />
          <span v-else>{{ initials }}</span>
        </div>
        <input ref="fileEl" type="file" accept="image/*" hidden @change="onFile" />
        <button class="cd-abtn ice" style="width: auto; font-size: 12px; padding: 8px 14px" :disabled="uploading" @click="fileEl?.click()">
          <CdIcon emoji="📷" icon="lucide:camera" :size="13" /> {{ uploading ? 'Uploading…' : 'Change photo' }}
        </button>
      </div>

      <label class="cd-lbl">Name</label>
      <input v-model="form.display_name" class="cd-inp" placeholder="Jane Smith" />
      <label class="cd-lbl">Headline</label>
      <input v-model="form.headline" class="cd-inp" placeholder="Helping founders close faster" />
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
        <div><label class="cd-lbl">Title</label><input v-model="form.title" class="cd-inp" placeholder="VP Product" /></div>
        <div><label class="cd-lbl">Company</label><input v-model="form.company" class="cd-inp" placeholder="Acme" /></div>
      </div>
      <label class="cd-lbl">Email</label>
      <input v-model="form.email" class="cd-inp" type="email" placeholder="jane@acme.com" />
      <label class="cd-lbl">Phone</label>
      <input v-model="form.phone" class="cd-inp" type="tel" placeholder="+1 555 000 0000" />
      <label class="cd-lbl">Website</label>
      <input v-model="form.website" class="cd-inp" placeholder="https://acme.com" />
      <template v-for="s in SOCIALS" :key="s.key">
        <label class="cd-lbl">{{ s.label }}</label>
        <input v-model="form[s.key]" class="cd-inp" :placeholder="s.placeholder" />
      </template>

      <div class="ce-toggle">
        <div>
          <div style="font-size: 13px; font-weight: 700">Share my activity</div>
          <div style="font-size: 11px; color: var(--cd-dim)">Let connections see scans, level-ups & streaks in their feed.</div>
        </div>
        <button
          class="cd-abtn"
          :class="form.broadcast_activity ? 'g' : ''"
          style="width: auto; font-size: 11px; padding: 6px 12px; flex-shrink: 0"
          :style="form.broadcast_activity ? '' : 'background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)'"
          @click="form.broadcast_activity = !form.broadcast_activity"
        >{{ form.broadcast_activity ? 'On' : 'Off' }}</button>
      </div>

      <button class="cd-abtn g" style="font-size: 15px; padding: 13px; margin-top: 8px" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save card' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ce {
  min-height: 100dvh;
  background: var(--cd-bg);
  color: var(--cd-text);
  display: flex;
  flex-direction: column;
}
.ce-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 8px) + 8px) 16px 8px;
  border-bottom: 1px solid var(--cd-bdr);
}
.ce-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 22px;
  letter-spacing: 1px;
}
.ce-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px max(20px, env(safe-area-inset-bottom));
  max-width: 460px;
  width: 100%;
  margin: 0 auto;
}
.ce-photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.ce-photo-img {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  color: var(--cd-accent);
  background: rgba(0, 255, 135, 0.12);
  border: 2px solid var(--cd-accent);
}
.ce-photo-img img { width: 100%; height: 100%; object-fit: cover; }
.ce-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 14px;
  padding: 12px 14px;
  margin: 14px 0 4px;
}
</style>
