<script setup lang="ts">
import { CARD_THEMES, normalizeCardTheme } from '~/composables/useCardThemes'
import type { CardViewData } from '~/components/card/View.vue'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id || ''))

interface PublicCard extends CardViewData {
  id: string
  name: string
}
// Explicit key (3rd arg) avoids Nuxt's buggy auto-key injection — see app/pages/account.vue.
const { data: card, error } = await useFetch<PublicCard>(() => `/api/cards/${id.value}`, {}, 'public-card')

const shareUrl = computed(() => (import.meta.client ? window.location.href : ''))

// ── Design preview mode ──
// `?preview=1` (or any `?theme=` override) shows a floating design switcher so
// the cardholder can flip through all designs on their real card. Real visitors
// never see it — they get the saved design only.
const previewMode = computed(() => route.query.preview === '1' || !!route.query.theme)
const overrideTheme = computed(() => (route.query.theme ? normalizeCardTheme(String(route.query.theme)) : null))
// The card as rendered — with the theme swapped when previewing a design.
const displayCard = computed(() =>
  card.value ? { ...card.value, card_theme: overrideTheme.value || card.value.card_theme } : null,
)
const theme = computed(() => normalizeCardTheme(displayCard.value?.card_theme))
function pickTheme(themeId: string) {
  router.replace({ query: { ...route.query, preview: '1', theme: themeId } })
}

// Public, shareable card page — give it a rich, person-specific title + OG/Twitter
// preview so a shared link unfurls nicely in messages and social.
const cardTitle = computed(() =>
  card.value
    ? `${card.value.name}${card.value.title || card.value.company ? ` — ${[card.value.title, card.value.company].filter(Boolean).join(' · ')}` : ''} · CardDesk`
    : 'Digital Card · CardDesk',
)
const cardDescription = computed(() =>
  card.value
    ? `${card.value.name}’s digital business card on CardDesk${card.value.headline ? ` — ${card.value.headline}` : ''}. Tap to save the contact or connect.`
    : 'A digital business card on CardDesk. Tap to save the contact or connect.',
)
useSeoMeta({
  title: cardTitle,
  description: cardDescription,
  ogType: 'profile',
  ogTitle: cardTitle,
  ogDescription: cardDescription,
  ogImage: () => card.value?.imageUrl || undefined,
  twitterCard: 'summary',
  twitterTitle: cardTitle,
  twitterDescription: cardDescription,
})
</script>

<template>
  <div class="cardpage" :class="{ 'is-preview': previewMode }" :data-card-theme="theme">
    <div v-if="error" class="cardpage-error">
      <div style="font-size: 40px; margin-bottom: 8px">🃏</div>
      <div style="font-size: 18px; font-weight: 800">Card not found</div>
      <NuxtLink to="/" class="cardpage-error-link">Go to CardDesk →</NuxtLink>
    </div>

    <CardView v-else-if="displayCard" :card="displayCard" :share-url="shareUrl" floating-qr :float-raised="previewMode">
      <template #footer>
        <NuxtLink to="/auth/register" class="cardpage-cta">Get your own CardDesk <CdIcon icon="lucide:chevron-right" :size="13" /></NuxtLink>
      </template>
    </CardView>

    <!-- Design preview switcher (only in ?preview=1 mode) -->
    <div v-if="previewMode && card" class="cardpage-switch">
      <div class="cardpage-switch-label">Preview design</div>
      <div class="cardpage-switch-row">
        <button
          v-for="t in CARD_THEMES"
          :key="t.id"
          type="button"
          class="cardpage-switch-btn"
          :class="{ on: theme === t.id }"
          @click="pickTheme(t.id)"
        >
          <span class="cardpage-switch-swatch" :style="{ background: t.swatch }"></span>
          <span class="cardpage-switch-name">{{ t.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cardpage {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
/* CardView is full-bleed and brings its own themed backdrop. */
.cardpage :deep(.cv) {
  flex: 1;
}
/* Leave room under the content for the floating Share button. */
.cardpage :deep(.cv-main) {
  padding-bottom: 104px;
}
/* Match the page background to each theme so over-scroll never flashes white. */
.cardpage[data-card-theme='carddesk'] { background: #080b12; }
.cardpage[data-card-theme='glass'] { background: #0a0b0f; }
.cardpage[data-card-theme='editorial'] { background: #f5f3ef; }
.cardpage[data-card-theme='tech'] { background: #ffffff; }

.cardpage-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: currentColor;
  opacity: 0.5;
  text-decoration: none;
}
.cardpage-cta:hover {
  opacity: 0.85;
}
.cardpage-error {
  margin: auto;
  text-align: center;
  color: var(--cd-text, #fff);
  padding: 40px;
}
.cardpage-error-link {
  display: inline-block;
  margin-top: 16px;
  color: #00bfff;
  text-decoration: none;
  font-weight: 700;
}

/* ── Design preview switcher (dev/preview only) ── */
/* Clear both the raised floating button and the switcher bar. */
.cardpage.is-preview :deep(.cv-main) {
  padding-bottom: 230px;
}
.cardpage-switch {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  transform: translateX(-50%);
  z-index: 400;
  width: min(440px, calc(100vw - 24px));
  padding: 10px 12px 12px;
  border-radius: 20px;
  background: rgba(14, 16, 22, 0.82);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 20px 50px -16px rgba(0, 0, 0, 0.6);
}
.cardpage-switch-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  margin-bottom: 8px;
}
.cardpage-switch-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
}
.cardpage-switch-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 7px 4px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.12s;
}
.cardpage-switch-btn:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.08);
}
.cardpage-switch-btn.on {
  border-color: #4da6ff;
  background: rgba(77, 166, 255, 0.14);
}
.cardpage-switch-swatch {
  width: 100%;
  aspect-ratio: 1.5 / 1;
  border-radius: 8px;
  background-size: cover;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.cardpage-switch-name {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}
</style>
