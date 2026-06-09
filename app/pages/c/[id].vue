<script setup lang="ts">
import { buildVCard, useShare } from '~/composables/useShare'
import { SOCIALS, socialUrl } from '~/types/socials'

definePageMeta({ layout: false })

const route = useRoute()
const id = computed(() => String(route.params.id || ''))
const { shareContact } = useShare()

interface PublicCard {
  id: string; name: string; title: string | null; company: string | null
  email: string | null; phone: string | null; website: string | null
  linkedin: string | null; instagram: string | null; twitter: string | null; youtube: string | null; behance: string | null
  headline: string | null; imageUrl: string | null
}
const { data: card, error } = await useFetch<PublicCard>(() => `/api/cards/${id.value}`)

const socialLinks = computed(() => (card.value ? SOCIALS.filter((s) => (card.value as any)[s.key]) : []))

useHead(() => ({ title: card.value ? `${card.value.name} · CardDesk` : 'CardDesk Card' }))

const initials = computed(() => {
  const n = card.value?.name || ''
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
})

// QR encodes the vCard itself, so anyone can scan the on-screen code with their
// phone camera and get a native "Add Contact" prompt — no extra tap.
const qr = ref('')
watchEffect(async () => {
  if (!card.value || !import.meta.client) return
  const QR = await import('qrcode')
  qr.value = await QR.toDataURL(buildVCard(card.value), { margin: 1, width: 300, color: { dark: '#060810', light: '#ffffff' } })
})

function addToContacts() {
  if (card.value) shareContact(card.value)
}
</script>

<template>
  <div class="cardpage">
    <div v-if="error" class="cardbox">
      <div style="font-size: 40px; margin-bottom: 8px">🃏</div>
      <div style="font-size: 18px; font-weight: 800">Card not found</div>
      <NuxtLink to="/" class="cd-abtn g" style="margin-top: 16px; text-decoration: none">Go to CardDesk</NuxtLink>
    </div>
    <div v-else-if="card" class="cardbox">
      <div class="cardpage-brand">CARD<span style="color: var(--cd-accent)">DESK</span></div>
      <div class="cardpage-avatar"><img v-if="card.imageUrl" :src="card.imageUrl" alt=""><span v-else>{{ initials }}</span></div>
      <div style="font-size: 22px; font-weight: 800; margin-bottom: 2px">{{ card.name }}</div>
      <div style="font-size: 13px; color: var(--cd-dim)">{{ [card.title, card.company].filter(Boolean).join(' · ') || 'On CardDesk' }}</div>
      <div v-if="card.headline" style="font-size: 12px; color: var(--cd-muted); margin-top: 6px; font-style: italic">“{{ card.headline }}”</div>

      <div v-if="card.website || socialLinks.length || card.phone || card.email" class="cardpage-links">
        <a v-if="card.website" :href="card.website" target="_blank" rel="noopener"><CdIcon emoji="🌐" icon="lucide:globe" :size="16" /></a>
        <a v-for="s in socialLinks" :key="s.key" :href="socialUrl(s.key, (card as any)[s.key])" target="_blank" rel="noopener" :aria-label="s.label"><Icon :name="s.icon" :size="16" /></a>
        <a v-if="card.phone" :href="`tel:${card.phone}`"><CdIcon emoji="📞" icon="lucide:phone" :size="16" /></a>
        <a v-if="card.email" :href="`mailto:${card.email}`"><CdIcon emoji="✉️" icon="lucide:mail" :size="16" /></a>
      </div>

      <div class="cardpage-qrbox" style="margin-top: 18px"><img v-if="qr" :src="qr" alt="Scan to save contact" width="220" height="220" style="display: block" /></div>
      <div style="font-size: 11px; color: var(--cd-dim); margin: 10px 0 16px">Scan with your camera to save, or tap below.</div>
      <button class="cd-abtn g" @click="addToContacts"><CdIcon emoji="📇" icon="lucide:user-plus" :size="15" /> Add to Contacts</button>
      <NuxtLink to="/auth/register" class="cardpage-cta">Get your own CardDesk →</NuxtLink>
    </div>
    <CdBrandFooter />
  </div>
</template>

<style scoped>
.cardpage {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--cd-bg, #060810);
  color: var(--cd-text, #fff);
}
.cardbox {
  width: 100%;
  max-width: 360px;
  text-align: center;
  background: var(--cd-bg2, #0d1018);
  border: 1px solid var(--cd-bdr, #1e2430);
  border-radius: 24px;
  padding: 28px 24px;
}
.cardpage-brand {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 19px;
  letter-spacing: 0.06em;
  color: var(--cd-muted);
  margin-bottom: 18px;
}
.cardpage-avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  color: var(--cd-accent);
  background: rgba(0, 255, 135, 0.12);
  border: 2px solid var(--cd-accent);
}
.cardpage-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cardpage-links {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 14px;
}
.cardpage-links a {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cd-bg, #060810);
  border: 1px solid var(--cd-bdr, #1e2430);
  color: var(--cd-text, #fff);
  text-decoration: none;
}
.cardpage-links a:hover { border-color: var(--cd-accent); color: var(--cd-accent); }
.cardpage-qrbox {
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  display: inline-block;
}
.cardpage-cta {
  display: block;
  margin-top: 16px;
  font-size: 12px;
  color: var(--cd-dim);
  text-decoration: none;
}
.cardpage-cta:hover { color: var(--cd-accent); }
</style>
