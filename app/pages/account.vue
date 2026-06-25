<script setup lang="ts">
import { INDUSTRIES } from '~/composables/useConstants'
import { SOCIALS, SOCIAL_KEYS } from '~/types/socials'
import { CARD_THEMES, normalizeCardTheme } from '~/composables/useCardThemes'

definePageMeta({ middleware: 'auth' })

useSeoMeta({
  title: 'Account · CardDesk',
  description: 'Manage your CardDesk profile, networking goal, digital card, Earnest Score and AI credits.',
  robots: 'noindex, nofollow',
})

const { user } = useUserSession()
const { logout } = useAuth()
const { success, error: showError } = useToast()
const { show: openFeedback } = useFeedbackSheet()
const { profile, loading: profileLoading, saved: profileSaved, loadProfile, saveProfile, fullName, company } = useProfile()

const email = computed(() => (user.value?.email as string) ?? '')
const initial = computed(() => {
  const name = fullName.value
  if (name) return name.charAt(0).toUpperCase()
  return email.value.charAt(0).toUpperCase() || '?'
})

const profileForm = ref({ first_name: '', last_name: '', title: '', industry: '', location: '', networking_goal: '' })

watch(profile, (p) => {
  profileForm.value = {
    first_name: p.first_name ?? '',
    last_name: p.last_name ?? '',
    title: p.title ?? '',
    industry: p.industry ?? '',
    location: p.location ?? '',
    networking_goal: p.networking_goal ?? '',
  }
}, { immediate: true })

const { contacts } = useContacts()

// Credit purchase: confirm the Stripe checkout on the success redirect.
const route = useRoute()
const router = useRouter()
const { confirmPurchase } = useCredits()
const analytics = useAnalytics()
const purchaseBanner = ref<string | null>(null)

// ─── Profile / Business Card tabs ───
// Profile and the shareable card live on one screen now, split into two tabs so
// it's easy to move between "who I am" (account) and "what I hand out" (card).
const tab = ref<'profile' | 'card'>(route.query.tab === 'card' ? 'card' : 'profile')

// ─── Business card ───
// The card is seeded server-side from the account profile, but is edited
// independently here. `accountCard` is the live account-derived truth we offer
// to sync into the card whenever the two drift apart.
const { data: card, refresh: refreshCard } = await useFetch<any>('/api/cards/me')

const cardForm = reactive<Record<string, any>>({
  display_name: '', title: '', company: '', headline: '',
  email: '', phone: '', website: '', office_address: '', broadcast_activity: true,
  card_theme: 'carddesk',
  ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, ''])),
})
const cardImageUrl = ref<string | null>(null)
const cardCoverUrl = ref<string | null>(null)
const cardLogoUrl = ref<string | null>(null)

watchEffect(() => {
  if (!card.value) return
  cardForm.display_name = card.value.display_name ?? ''
  cardForm.title = card.value.title ?? ''
  cardForm.company = card.value.company ?? ''
  cardForm.headline = card.value.headline ?? ''
  cardForm.email = card.value.email ?? ''
  cardForm.phone = card.value.phone ?? ''
  cardForm.website = card.value.website ?? ''
  cardForm.office_address = card.value.office_address ?? ''
  for (const k of SOCIAL_KEYS) cardForm[k] = card.value[k] ?? ''
  cardForm.broadcast_activity = card.value.broadcast_activity ?? true
  cardForm.card_theme = normalizeCardTheme(card.value.card_theme)
  cardImageUrl.value = card.value.imageUrl ?? null
  cardCoverUrl.value = card.value.coverUrl ?? null
  cardLogoUrl.value = card.value.logoUrl ?? null
})

// Live data fed to the <CardView> preview — mirrors unsaved edits, and falls
// back to the Earnest avatar for the photo (same as the public card does).
const previewCard = computed(() => ({
  ...cardForm,
  name: cardForm.display_name || fullName.value || 'Your name',
  imageUrl: cardImageUrl.value || profile.value.avatarUrl || null,
  coverUrl: cardCoverUrl.value || null,
  logoUrl: cardLogoUrl.value || null,
}))

const cardInitials = computed(() =>
  (cardForm.display_name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
)

// Account-derived values the card can adopt. Drives the "sync" prompt.
const SYNC_FIELDS: { key: string; label: string; value: () => string }[] = [
  { key: 'display_name', label: 'Name', value: () => fullName.value },
  { key: 'title', label: 'Title', value: () => profile.value.title ?? '' },
  { key: 'company', label: 'Company', value: () => company.value },
  { key: 'email', label: 'Email', value: () => email.value },
]
// Fields where the account has a value that differs from the card.
const cardDiffs = computed(() =>
  SYNC_FIELDS.filter((f) => {
    const v = f.value()
    return v && v !== cardForm[f.key]
  })
)
function syncFromAccount() {
  for (const f of cardDiffs.value) cardForm[f.key] = f.value()
}

const cardSaving = ref(false)
async function saveCard() {
  cardSaving.value = true
  try {
    // Only send cover_image when the user cleared it (null) — uploads set it
    // server-side, so an unchanged cover is left untouched (undefined → skipped).
    const body: Record<string, any> = { ...cardForm }
    if (!cardCoverUrl.value) body.cover_image = null
    if (!cardLogoUrl.value) body.logo_image = null
    await $fetch('/api/cards/me', { method: 'PATCH', body })
    success('Card saved')
    await refreshCard()
  } catch {
    showError('Could not save card')
  } finally {
    cardSaving.value = false
  }
}

// Earnest (Directus) profile avatar — distinct from the card photo. Uploading
// here updates the user's actual Earnest account photo, shared across Earnest.
const avatarUploading = ref(false)
const avatarFileEl = ref<HTMLInputElement | null>(null)
async function onAvatarFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  avatarUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', await downscaleImage(f), f.name || 'avatar.jpg')
    const r = await $fetch<{ avatarUrl: string }>('/api/profile/avatar', { method: 'POST', body: fd })
    profile.value.avatarUrl = r.avatarUrl
    success('Photo updated — synced to your Earnest account')
  } catch {
    showError('Upload failed (max 5MB)')
  } finally {
    avatarUploading.value = false
  }
}

const cardUploading = ref(false)
const cardFileEl = ref<HTMLInputElement | null>(null)
async function onCardFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  cardUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', await downscaleImage(f), f.name || 'card.jpg')
    const r = await $fetch<{ imageUrl: string }>('/api/cards/image', { method: 'POST', body: fd })
    cardImageUrl.value = r.imageUrl
    success('Photo updated')
  } catch {
    showError('Upload failed (max 5MB)')
  } finally {
    cardUploading.value = false
  }
}

// Cover/banner image — a wide 16:9-ish header behind the profile photo.
const coverUploading = ref(false)
const coverFileEl = ref<HTMLInputElement | null>(null)
async function onCoverFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  coverUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', await downscaleImage(f), f.name || 'cover.jpg')
    const r = await $fetch<{ coverUrl: string }>('/api/cards/cover', { method: 'POST', body: fd })
    cardCoverUrl.value = r.coverUrl
    success('Cover updated')
  } catch {
    showError('Upload failed (max 5MB)')
  } finally {
    coverUploading.value = false
  }
}

// Company logo — shown opposite the profile photo.
const logoUploading = ref(false)
const logoFileEl = ref<HTMLInputElement | null>(null)
async function onLogoFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  logoUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', await downscaleImage(f), f.name || 'logo.png')
    const r = await $fetch<{ logoUrl: string }>('/api/cards/logo', { method: 'POST', body: fd })
    cardLogoUrl.value = r.logoUrl
    success('Logo updated')
  } catch {
    showError('Upload failed (max 5MB)')
  } finally {
    logoUploading.value = false
  }
}

// Earnest Score — server returns { current_score, dimension_scores };
// label is derived here from score bands to match Earnest's /account page.
const earnestScore = ref<{ current_score: number; dimension_scores: Record<string, number> } | null>(null)

function scoreLabel(score: number): string {
  if (score >= 81) return 'Relentless'
  if (score >= 61) return 'Resolute'
  if (score >= 41) return 'Steady'
  if (score >= 21) return 'Builder'
  return 'Seeker'
}

onMounted(async () => {
  loadProfile()
  try {
    const score = await $fetch<any>('/api/earnest-score')
    if (score) earnestScore.value = score
  } catch { /* score not available */ }

  if (route.query.credits_purchased === 'true' && typeof route.query.session_id === 'string') {
    const res = await confirmPurchase(route.query.session_id)
    purchaseBanner.value = res?.credits
      ? `🎉 ${res.credits} credits added — happy networking!`
      : 'Purchase received — your credits will appear shortly.'
    router.replace({ query: {} })
    setTimeout(() => (purchaseBanner.value = null), 5000)
  }
})

function doSaveProfile() {
  saveProfile(profileForm.value)
}

// Earnest AI score coach. account.vue is a standalone route, so we seed + open
// the shared chat panel, then route to the app shell where the panel renders.
const { open: openChat } = useChat()
function improveScore() {
  if (!earnestScore.value) return
  analytics.aiFeatureUse('chat')
  openChat({
    scope: 'score',
    title: 'Improving your score',
    context: {
      current_score: earnestScore.value.current_score,
      label: scoreLabel(earnestScore.value.current_score),
      dimension_scores: earnestScore.value.dimension_scores,
      contacts: contacts.value.length,
      clients: contacts.value.filter((c: any) => c.is_client).length,
    },
    focus: 'their Earnest Score on the Account page — the overall score and its dimension breakdown',
    intro: `Your Earnest Score is ${earnestScore.value.current_score} (${scoreLabel(earnestScore.value.current_score)}). Want a prioritized plan to raise it, or should I break down what's holding each area back?`,
  })
  router.push('/')
}

const goalLoading = ref(false)
async function suggestGoal() {
  goalLoading.value = true
  analytics.aiFeatureUse('goal')
  try {
    const data = await $fetch<{ goal: string }>('/api/ai-goal', {
      method: 'POST',
      body: {
        contactCount: contacts.value.length,
        clientCount: contacts.value.filter((c: any) => c.is_client).length,
      },
    })
    if (data.goal) profileForm.value.networking_goal = data.goal
  } catch (err: any) {
    console.error('[account] AI goal suggestion failed:', err)
  } finally {
    goalLoading.value = false
  }
}
</script>

<template>
  <div class="acct-page">
    <div class="acct-container">
      <NuxtLink to="/" class="cd-back"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Back</NuxtLink>

      <div
        v-if="purchaseBanner"
        style="margin-bottom: 14px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--cd-accent); background: color-mix(in srgb, var(--cd-accent) 12%, transparent); color: var(--cd-text); font-size: 13px; font-weight: 700; text-align: center"
      >
        {{ purchaseBanner }}
      </div>

      <div class="acct-hero">
        <div class="acct-avatar">
          <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="" />
          <span v-else>{{ initial }}</span>
        </div>
        <div v-if="fullName" style="font-size: 16px; font-weight: 800; margin-bottom: 2px">{{ fullName }}</div>
        <div class="acct-email">{{ email }}</div>
        <div v-if="company" style="font-size: 12px; color: var(--cd-dim); margin-top: 2px">{{ company }}</div>
      </div>

      <!-- Profile / Business Card tabs (shared universal pill tabs) -->
      <div class="acct-tabswrap">
        <CdTabs
          v-model="tab"
          :items="[
            { key: 'profile', label: 'Profile', emoji: '👤', icon: 'lucide:user' },
            { key: 'card', label: 'Business Card', emoji: '🪪', icon: 'lucide:contact' },
          ]"
        />
      </div>

      <!-- ───────────── PROFILE TAB ───────────── -->
      <template v-if="tab === 'profile'">
        <div class="acct-section">
          <div class="acct-section-title">Profile Photo</div>
          <div class="acct-photo-row">
            <div class="acct-photo-img">
              <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="" />
              <span v-else>{{ initial }}</span>
            </div>
            <div class="acct-photo-copy">
              <input ref="avatarFileEl" type="file" accept="image/*" hidden @change="onAvatarFile" />
              <button class="acct-card-btn" :disabled="avatarUploading" @click="avatarFileEl?.click()">
                <CdIcon emoji="📷" icon="lucide:camera" :size="14" /> {{ avatarUploading ? 'Uploading…' : profile.avatarUrl ? 'Change photo' : 'Add a photo' }}
              </button>
              <div class="acct-earnest-note">
                <CdIcon icon="lucide:info" :size="12" />
                <span>This is your Earnest account photo — updating it changes it everywhere you use Earnest.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="acct-section">
          <PhoneUsageCard />
        </div>

        <div class="acct-section">
          <div class="acct-section-title">Your Profile</div>
          <div class="acct-earnest-note" style="margin-bottom: 10px">
            <CdIcon icon="lucide:link" :size="12" />
            <span>Your CardDesk profile is your Earnest account — changes here sync to Earnest.</span>
          </div>
          <div class="acct-profile-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
              <div>
                <label class="cd-lbl">First Name</label>
                <input v-model="profileForm.first_name" class="cd-inp" placeholder="Jane" />
              </div>
              <div>
                <label class="cd-lbl">Last Name</label>
                <input v-model="profileForm.last_name" class="cd-inp" placeholder="Smith" />
              </div>
            </div>
            <label class="cd-lbl">Title / Role</label>
            <input v-model="profileForm.title" class="cd-inp" placeholder="VP Sales" />
            <div v-if="profile.organization?.name">
              <label class="cd-lbl">Organization</label>
              <div style="padding: 10px 16px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg2); color: var(--cd-muted); font-size: 13px; margin-bottom: 8px">
                {{ profile.organization.name }}
                <span v-if="profile.organization.industry" style="color: var(--cd-dim); font-size: 12px"> · {{ profile.organization.industry }}</span>
              </div>
            </div>
            <label class="cd-lbl">Industry</label>
            <select v-model="profileForm.industry" class="cd-inp" style="cursor: pointer">
              <option value="">Select...</option>
              <option v-for="ind in INDUSTRIES" :key="ind" :value="ind">{{ ind }}</option>
            </select>
            <label class="cd-lbl">Location <span style="color: var(--cd-dim); font-weight: 600; text-transform: none; letter-spacing: 0">· city / region, helps Earnest AI</span></label>
            <input v-model="profileForm.location" class="cd-inp" placeholder="San Francisco, CA" />
            <div style="display: flex; justify-content: space-between; align-items: center">
              <label class="cd-lbl">Networking Goal</label>
              <button
                class="acct-ai-btn"
                :disabled="goalLoading"
                @click="suggestGoal"
              >
                {{ goalLoading ? 'Thinking...' : 'Earnest AI Suggest' }}
              </button>
            </div>
            <textarea
              v-model="profileForm.networking_goal"
              class="cd-inp"
              style="min-height: 80px; resize: vertical"
              placeholder="What are you trying to achieve with your network?"
            ></textarea>
            <button class="acct-save-btn" @click="doSaveProfile">
              {{ profileSaved ? 'Saved!' : 'Save Profile' }}
            </button>
            <div v-if="cardDiffs.length" class="acct-sync-hint">
              <CdIcon icon="lucide:contact" :size="13" />
              <span>Your business card is out of sync with this profile.</span>
              <button class="acct-sync-link" @click="tab = 'card'">Review card →</button>
            </div>
          </div>
        </div>

        <!-- Earnest Score -->
        <div v-if="earnestScore" class="acct-section">
          <div class="acct-section-title">Earnest Score</div>
          <div style="background: var(--cd-bg2); border: 1.5px solid var(--cd-bdr); border-radius: 12px; padding: 14px">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px">
              <div style="font-size: 32px; font-weight: 800; color: var(--cd-accent)">{{ earnestScore.current_score }}</div>
              <div>
                <div style="font-size: 14px; font-weight: 700; color: var(--cd-text)">{{ scoreLabel(earnestScore.current_score) }}</div>
                <div style="font-size: 11px; color: var(--cd-muted)">Your CRM activity in CardDesk contributes to this score</div>
              </div>
            </div>
            <div v-if="earnestScore.dimension_scores" style="display: flex; flex-direction: column; gap: 4px">
              <div v-for="(value, key) in earnestScore.dimension_scores" :key="key" style="display: flex; align-items: center; gap: 8px">
                <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--cd-dim); width: 80px; flex-shrink: 0">{{ key }}</span>
                <div style="flex: 1; height: 4px; background: var(--cd-bdr); border-radius: 2px; overflow: hidden">
                  <div style="height: 100%; background: var(--cd-accent); border-radius: 2px" :style="'width:' + Math.min(100, (value / 20) * 100) + '%'"></div>
                </div>
                <span style="font-size: 10px; font-weight: 700; color: var(--cd-muted); width: 24px; text-align: right">{{ value }}</span>
              </div>
            </div>
            <button class="acct-card-btn" style="margin-top: 12px; width: 100%; justify-content: center; color: var(--cd-accent); border-color: color-mix(in srgb, var(--cd-accent) 30%, transparent)" @click="improveScore">
              <CdEarnestMark :size="14" /> How do I improve my score?
            </button>
          </div>
        </div>

        <!-- Help & Feedback -->
        <div class="acct-section">
          <div class="acct-section-title">Help &amp; Feedback</div>
          <div style="background: var(--cd-bg2); border: 1.5px solid var(--cd-bdr); border-radius: 12px; padding: 14px">
            <NuxtLink to="/help" class="acct-card-btn" style="margin-bottom: 10px">
              <CdIcon icon="lucide:life-buoy" :size="14" /> Help &amp; FAQ
            </NuxtLink>

            <div style="font-size: 12px; color: var(--cd-muted); margin-bottom: 10px; line-height: 1.5">
              Found a bug or have an idea? Tell us — it goes straight to the team.
            </div>
            <button class="acct-card-btn" style="width: 100%; justify-content: center" @click="openFeedback('bug')">
              <CdIcon icon="lucide:message-square-plus" :size="14" /> Send feedback
            </button>
          </div>
        </div>

        <div class="acct-section">
          <button class="acct-logout" @click="logout">
            Log Out
          </button>
        </div>
      </template>

      <!-- ───────────── BUSINESS CARD TAB ───────────── -->
      <template v-else>
        <div class="acct-section">
          <div class="acct-section-title">Your CardDesk Card</div>
          <div style="font-size: 12px; color: var(--cd-muted); margin-bottom: 14px; line-height: 1.5">
            Your shareable digital business card — photo, title, company &amp; links, with a QR for in-person sharing. It starts from your account info but you can tailor it without changing your account.
          </div>

          <!-- Sync prompt when the card has drifted from the account profile -->
          <div v-if="cardDiffs.length" class="acct-sync-banner">
            <div class="acct-sync-copy">
              <div class="acct-sync-title"><CdIcon icon="lucide:refresh-cw" :size="13" /> Account info changed</div>
              <div class="acct-sync-sub">
                {{ cardDiffs.map((d) => d.label).join(', ') }} on your account
                {{ cardDiffs.length === 1 ? 'differs' : 'differ' }} from your card.
              </div>
            </div>
            <button class="acct-sync-btn" @click="syncFromAccount">Sync to card</button>
          </div>

          <!-- Live preview of the shareable card in the chosen design -->
          <div class="acct-card-preview">
            <CardView :card="previewCard" :interactive="false" />
          </div>

          <!-- Design picker -->
          <div class="acct-section-title" style="margin-top: 4px">Design</div>
          <div class="acct-themes">
            <button
              v-for="t in CARD_THEMES"
              :key="t.id"
              type="button"
              class="acct-theme"
              :class="{ on: cardForm.card_theme === t.id }"
              @click="cardForm.card_theme = t.id"
            >
              <span class="acct-theme-swatch" :style="{ background: t.swatch }">
                <span class="acct-theme-mark" :style="{ color: t.swatchInk }">Aa</span>
              </span>
              <span class="acct-theme-label">{{ t.label }}</span>
              <CdIcon v-if="cardForm.card_theme === t.id" icon="lucide:check" emoji="✓" :size="13" class="acct-theme-check" />
            </button>
          </div>
          <div class="acct-theme-hint">{{ CARD_THEMES.find((t) => t.id === cardForm.card_theme)?.hint }}</div>

          <!-- Cover / banner image -->
          <div class="acct-cover">
            <div class="acct-cover-img" :class="{ empty: !cardCoverUrl }">
              <img v-if="cardCoverUrl" :src="cardCoverUrl" alt="Cover" />
              <span v-else><CdIcon emoji="🖼️" icon="lucide:image" :size="18" /> Add a cover photo</span>
            </div>
            <input ref="coverFileEl" type="file" accept="image/*" hidden @change="onCoverFile" />
            <div class="acct-cover-actions">
              <button class="cd-abtn ice" style="width: auto; font-size: 12px; padding: 8px 14px" :disabled="coverUploading" @click="coverFileEl?.click()">
                <CdIcon emoji="📷" icon="lucide:camera" :size="13" /> {{ coverUploading ? 'Uploading…' : cardCoverUrl ? 'Change cover' : 'Add cover' }}
              </button>
              <button v-if="cardCoverUrl" class="acct-cover-remove" :disabled="coverUploading" @click="cardCoverUrl = null">Remove</button>
            </div>
            <div style="font-size: 11px; color: var(--cd-dim); text-align: center">Wide banner shown across the top of your card (optional).</div>
          </div>

          <!-- Company logo (shown opposite the profile photo) -->
          <div class="acct-logo-row">
            <div class="acct-logo-img" :class="{ empty: !cardLogoUrl }">
              <img v-if="cardLogoUrl" :src="cardLogoUrl" alt="Logo" />
              <CdIcon v-else emoji="🏢" icon="lucide:image" :size="18" />
            </div>
            <div class="acct-logo-copy">
              <div style="font-size: 13px; font-weight: 700">Company logo</div>
              <div style="font-size: 11px; color: var(--cd-dim); line-height: 1.4">Shown opposite your photo. PNG with transparency works best.</div>
              <input ref="logoFileEl" type="file" accept="image/*" hidden @change="onLogoFile" />
              <div class="acct-logo-actions">
                <button class="acct-card-btn" style="font-size: 12px; padding: 7px 12px" :disabled="logoUploading" @click="logoFileEl?.click()">
                  <CdIcon emoji="📷" icon="lucide:camera" :size="13" /> {{ logoUploading ? 'Uploading…' : cardLogoUrl ? 'Change' : 'Add logo' }}
                </button>
                <button v-if="cardLogoUrl" class="acct-cover-remove" :disabled="logoUploading" @click="cardLogoUrl = null">Remove</button>
              </div>
            </div>
          </div>

          <!-- Photo — defaults to your Earnest avatar until you set a card-specific one -->
          <div class="acct-cardphoto">
            <div class="acct-cardphoto-img">
              <img v-if="cardImageUrl || profile.avatarUrl" :src="cardImageUrl || profile.avatarUrl || ''" alt="Card photo" />
              <span v-else>{{ cardInitials }}</span>
            </div>
            <input ref="cardFileEl" type="file" accept="image/*" hidden @change="onCardFile" />
            <button class="cd-abtn ice" style="width: auto; font-size: 12px; padding: 8px 14px" :disabled="cardUploading" @click="cardFileEl?.click()">
              <CdIcon emoji="📷" icon="lucide:camera" :size="13" /> {{ cardUploading ? 'Uploading…' : 'Change photo' }}
            </button>
          </div>

          <div class="acct-card-form">
            <label class="cd-lbl">Name</label>
            <input v-model="cardForm.display_name" class="cd-inp" placeholder="Jane Smith" />
            <label class="cd-lbl">Headline</label>
            <input v-model="cardForm.headline" class="cd-inp" placeholder="Helping founders close faster" />
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
              <div><label class="cd-lbl">Title</label><input v-model="cardForm.title" class="cd-inp" placeholder="VP Product" /></div>
              <div><label class="cd-lbl">Company</label><input v-model="cardForm.company" class="cd-inp" placeholder="Acme" /></div>
            </div>
            <label class="cd-lbl">Email</label>
            <input v-model="cardForm.email" class="cd-inp" type="email" placeholder="jane@acme.com" />
            <label class="cd-lbl">Phone</label>
            <input v-model="cardForm.phone" class="cd-inp" type="tel" placeholder="+1 555 000 0000" />
            <label class="cd-lbl">Website</label>
            <input v-model="cardForm.website" class="cd-inp" placeholder="https://acme.com" />
            <label class="cd-lbl">Office Address <span style="color: var(--cd-dim); font-weight: 600; text-transform: none; letter-spacing: 0">· shown on your shared card</span></label>
            <textarea v-model="cardForm.office_address" class="cd-inp" style="min-height: 48px; resize: vertical" placeholder="123 Market St, Suite 400&#10;San Francisco, CA 94105"></textarea>
            <template v-for="s in SOCIALS" :key="s.key">
              <label class="cd-lbl">{{ s.label }}</label>
              <input v-model="cardForm[s.key]" class="cd-inp" :placeholder="s.placeholder" />
            </template>

            <div class="acct-card-toggle">
              <div>
                <div style="font-size: 13px; font-weight: 700">Share my activity</div>
                <div style="font-size: 11px; color: var(--cd-dim)">Let connections see scans, level-ups &amp; streaks in their feed.</div>
              </div>
              <button
                class="cd-abtn"
                :class="cardForm.broadcast_activity ? 'g' : ''"
                style="width: auto; font-size: 11px; padding: 6px 12px; flex-shrink: 0"
                :style="cardForm.broadcast_activity ? '' : 'background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)'"
                @click="cardForm.broadcast_activity = !cardForm.broadcast_activity"
              >{{ cardForm.broadcast_activity ? 'On' : 'Off' }}</button>
            </div>

            <button class="cd-abtn g" style="font-size: 15px; padding: 13px; margin-top: 8px" :disabled="cardSaving" @click="saveCard">
              {{ cardSaving ? 'Saving…' : 'Save card' }}
            </button>
          </div>
        </div>
      </template>

      <CdBrandFooter />
    </div>
  </div>
</template>

<style scoped>
.acct-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: 'Barlow', sans-serif;
  padding: calc(env(safe-area-inset-top, 16px) + 16px) 16px 32px;
}
.acct-container {
  max-width: 400px;
  margin: 0 auto;
}
.acct-back {
  display: inline-block;
  font-size: 13px;
  font-weight: 700;
  color: var(--cd-dim);
  text-decoration: none;
  margin-bottom: 24px;
  cursor: pointer;
}
.acct-back:hover {
  color: var(--cd-text);
}
.acct-hero {
  text-align: center;
  margin-bottom: 20px;
}
.acct-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--cd-bg2);
  border: 2px solid var(--cd-bdr);
  color: var(--cd-text);
  font-size: 26px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.acct-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.acct-email {
  font-size: 14px;
  color: var(--cd-muted);
  font-weight: 600;
}
/* ── Profile / Card tab switcher (centred universal pill tabs) ── */
.acct-tabswrap {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}
/* ── Profile photo row + Earnest sync note ── */
.acct-photo-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.acct-photo-img {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
  border: 2px solid var(--cd-bdr);
}
.acct-photo-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.acct-photo-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.acct-earnest-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--cd-muted);
}
.acct-earnest-note :deep(svg) {
  flex-shrink: 0;
  margin-top: 1px;
}
.acct-section {
  margin-bottom: 24px;
}
.acct-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--cd-dim);
  margin-bottom: 10px;
}
.acct-logout {
  width: 100%;
  padding: 13px;
  border-radius: 9999px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.06);
  color: #f87171;
  font-size: 14px;
  font-weight: 700;
  font-family: sans-serif;
  cursor: pointer;
  transition: background 0.15s;
}
.acct-logout:hover {
  background: rgba(248, 113, 113, 0.12);
}
.acct-profile-form {
  display: flex;
  flex-direction: column;
}
.acct-save-btn {
  margin-top: 8px;
  width: 100%;
  padding: 11px;
  border-radius: 9999px;
  border: none;
  background: var(--cd-accent);
  /* Accent is near-black in light / near-white in dark, so mirror the page
   * background for the label to stay legible in both modes. */
  color: var(--cd-bg);
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
}
.acct-save-btn:hover {
  opacity: 0.85;
}
.acct-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.acct-card-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  border-radius: 9999px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg);
  color: var(--cd-text);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: border-color 0.15s;
}
.acct-card-btn:hover {
  border-color: var(--cd-accent);
}
.acct-ai-btn {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 9999px;
  border: 1px solid var(--cd-bdr);
  background: transparent;
  color: var(--cd-accent);
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}
.acct-ai-btn:hover {
  opacity: 0.8;
}
.acct-ai-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
/* ── Profile-tab hint that the card has drifted ── */
.acct-sync-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 12px;
  color: var(--cd-muted);
}
.acct-sync-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--cd-accent);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}
/* ── Card-tab sync banner ── */
.acct-sync-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
  background: color-mix(in srgb, var(--cd-accent) 8%, transparent);
  margin-bottom: 16px;
}
.acct-sync-copy {
  flex: 1;
  min-width: 0;
}
.acct-sync-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 800;
  color: var(--cd-text);
}
.acct-sync-sub {
  font-size: 11px;
  color: var(--cd-muted);
  margin-top: 2px;
}
.acct-sync-btn {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 9999px;
  border: none;
  background: var(--cd-accent);
  color: var(--cd-bg);
  font-size: 12px;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
}
.acct-sync-btn:hover {
  opacity: 0.85;
}
/* ── Live card preview ── */
.acct-card-preview {
  position: relative;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--cd-bdr);
  margin-bottom: 18px;
  /* Let CardView paint its own themed backdrop edge-to-edge. */
}
.acct-card-preview :deep(.cv) {
  min-height: 0;
}
.acct-card-preview :deep(.cv-main) {
  padding: 30px 18px;
  max-width: 340px;
}
/* With a cover the banner provides the top edge — drop the column's top pad. */
.acct-card-preview :deep(.cv--cover .cv-main) {
  padding-top: 0;
}
/* ── Design / theme picker ── */
.acct-themes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}
.acct-theme {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  border-radius: 12px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg2);
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.12s ease;
}
.acct-theme:hover {
  transform: translateY(-2px);
}
.acct-theme.on {
  border-color: var(--cd-accent);
  box-shadow: 0 0 0 1px var(--cd-accent);
}
.acct-theme-swatch {
  width: 100%;
  aspect-ratio: 1 / 1.15;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.acct-theme-mark {
  font-size: 15px;
  font-weight: 800;
  font-family: 'Bauer Bodoni', Georgia, serif;
  opacity: 0.95;
}
.acct-theme-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--cd-muted);
}
.acct-theme.on .acct-theme-label {
  color: var(--cd-text);
}
.acct-theme-check {
  position: absolute;
  top: 5px;
  right: 5px;
  color: var(--cd-accent);
}
.acct-theme-hint {
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--cd-dim);
  margin-bottom: 18px;
  min-height: 17px;
}
/* ── Card cover / banner ── */
.acct-cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.acct-cover-img {
  width: 100%;
  aspect-ratio: 16 / 6.2;
  border-radius: 14px;
  overflow: hidden;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  display: flex;
  align-items: center;
  justify-content: center;
}
.acct-cover-img.empty {
  border-style: dashed;
}
.acct-cover-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.acct-cover-img span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
  color: var(--cd-dim);
}
.acct-cover-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.acct-cover-remove {
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--cd-dim);
  cursor: pointer;
}
.acct-cover-remove:hover {
  color: #f87171;
}
/* ── Company logo ── */
.acct-logo-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.acct-logo-img {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  color: var(--cd-dim);
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
}
.acct-logo-img.empty {
  border-style: dashed;
}
.acct-logo-img img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.acct-logo-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.acct-logo-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}
/* ── Card photo ── */
.acct-cardphoto {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.acct-cardphoto-img {
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
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
  border: 2px solid var(--cd-accent);
}
.acct-cardphoto-img img { width: 100%; height: 100%; object-fit: cover; }
.acct-card-form {
  display: flex;
  flex-direction: column;
}
.acct-card-toggle {
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
