<script setup lang="ts">
import { normalizeCardTheme } from '~/composables/useCardThemes'
import type { CardViewData } from '~/components/card/View.vue'

// Chromeless: this page is meant to be iframed onto third-party sites.
definePageMeta({ layout: false })

const route = useRoute()
const id = computed(() => String(route.params.id || ''))

interface EmbedPayload {
  card: (CardViewData & { id: string; name: string }) | null
  booking: { enabled: boolean; url: string | null }
}
// Explicit key (3rd arg) avoids Nuxt's buggy auto-key injection — see app/pages/account.vue.
const { data, error } = await useFetch<EmbedPayload>(() => `/api/embed/${id.value}`, {}, 'embed-card')

const card = computed(() => data.value?.card ?? null)
const booking = computed(() => data.value?.booking ?? { enabled: false, url: null })

// Theme: use the card's saved design, with an optional `?theme=` override so a
// host can match their site without changing the saved card.
const overrideTheme = computed(() => (route.query.theme ? normalizeCardTheme(String(route.query.theme)) : null))
const theme = computed(() => normalizeCardTheme(overrideTheme.value || card.value?.card_theme))
const displayCard = computed(() => (card.value ? { ...card.value, card_theme: theme.value } : null))

const bookingOpen = ref(false)
const bookingDone = ref(false)
const bookingSrc = computed(() => (booking.value.url ? `${booking.value.url}?embed=1` : ''))

// ── Auto-resize: tell the host page (embed.js) how tall to make the iframe ──
function postHeight() {
  if (!import.meta.client || window.parent === window) return
  const h = Math.ceil(document.documentElement.getBoundingClientRect().height)
  window.parent.postMessage({ source: 'carddesk', type: 'embed:height', height: h }, '*')
}

let ro: ResizeObserver | null = null
function onMessage(e: MessageEvent) {
  // Earnest's embedded booking flow signals completion.
  if (e.data?.source === 'earnest' && e.data?.type === 'earnest:booking:done') {
    bookingDone.value = true
  }
}

onMounted(() => {
  postHeight()
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(() => postHeight())
    ro.observe(document.documentElement)
  }
  window.addEventListener('message', onMessage)
  window.addEventListener('load', postHeight)
})
onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('message', onMessage)
})
watch([bookingOpen, bookingDone], () => nextTick(postHeight))

useSeoMeta({ robots: 'noindex, nofollow' })
</script>

<template>
  <div class="embed" :data-card-theme="theme">
    <div v-if="error || !displayCard" class="embed-error">Card unavailable</div>

    <template v-else>
      <CardView :card="displayCard" :share-url="''" :interactive="true" />

      <!-- Earnest-gated booking. Card-only users never see this. -->
      <div v-if="booking.enabled" class="embed-book" :class="{ 'is-open': bookingOpen }">
        <button v-if="!bookingOpen" type="button" class="embed-book-btn" @click="bookingOpen = true">
          <CdIcon icon="lucide:calendar" :size="15" /> Book a call
        </button>
        <div v-else class="embed-book-frame">
          <iframe :src="bookingSrc" title="Book a time" loading="lazy" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.embed {
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* Match the backdrop to each theme so the iframe never flashes white. */
.embed[data-card-theme='carddesk'] { background: #080b12; }
.embed[data-card-theme='glass'] { background: #0a0b0f; }
.embed[data-card-theme='editorial'] { background: #f5f3ef; }
.embed[data-card-theme='tech'] { background: #ffffff; }

.embed :deep(.cv) { flex: 1; }

.embed-error {
  margin: auto;
  padding: 40px;
  text-align: center;
  font-family: 'Barlow', system-ui, sans-serif;
  color: #888;
}

.embed-book {
  padding: 0 20px 22px;
  display: flex;
  justify-content: center;
}
.embed-book-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  font-family: 'Barlow', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
  padding: 12px 22px;
  border-radius: 999px;
  border: 1.5px solid transparent;
  transition: transform 0.12s ease, opacity 0.2s ease;
}
.embed-book-btn:hover { transform: translateY(-1px); }
/* Theme-aware button colors. */
.embed[data-card-theme='carddesk'] .embed-book-btn { background: #70ffd7; color: #032015; }
.embed[data-card-theme='glass'] .embed-book-btn { background: rgba(255, 255, 255, 0.12); color: #fff; border-color: rgba(255, 255, 255, 0.25); backdrop-filter: blur(8px); }
.embed[data-card-theme='editorial'] .embed-book-btn { background: #2b2620; color: #f5f3ef; }
.embed[data-card-theme='tech'] .embed-book-btn { background: #1e99c1; color: #fff; }

.embed-book.is-open { padding-bottom: 0; }
.embed-book-frame {
  width: 100%;
}
.embed-book-frame iframe {
  width: 100%;
  height: 640px;
  border: 0;
  display: block;
}
</style>
