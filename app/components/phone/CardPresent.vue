<script setup lang="ts">
/**
 * "My card" overlay — opens the user's actual full digital card (the same
 * <CardView> the public /c/:id page renders) as a full-screen takeover, one tap
 * from the header card button (and the "My card" quick action / PWA shortcut).
 * The QR for showing your phone lives inside it via CardView's floating Share
 * button.
 */
const { open, hide } = usePresentCard()

const card = ref<any>(null)
const busy = ref(false)
const loadError = ref(false)

async function ensureCard() {
  if (card.value) return
  busy.value = true
  loadError.value = false
  try {
    card.value = await $fetch('/api/cards/me')
  } catch {
    loadError.value = true
  } finally {
    busy.value = false
  }
}

watch(open, (v) => {
  if (v) ensureCard()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="mycard">
      <div v-if="open" class="mycard-ov">
        <button class="mycard-x" type="button" aria-label="Close" @click="hide"><CdIcon emoji="×" icon="lucide:x" :size="22" /></button>

        <div class="mycard-scroll">
          <CardView v-if="card" :card="card" :share-url="card.url" floating-qr />

          <div v-else-if="loadError" class="mycard-state">
            <CdIcon emoji="📡" icon="lucide:wifi-off" :size="26" />
            <div>Couldn't load your card.</div>
            <button class="cd-abtn g" style="width: auto; font-size: 13px; padding: 9px 16px" @click="ensureCard">
              <CdIcon emoji="🔄" icon="lucide:refresh-cw" :size="13" /> Try again
            </button>
          </div>

          <div v-else class="mycard-state">
            <div class="mycard-spin"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="30" /></div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mycard-ov {
  position: fixed;
  inset: 0;
  z-index: 230;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: #060810;
}
.mycard-scroll {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.mycard-scroll :deep(.cv) {
  flex: 1;
}
.mycard-x {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  right: 14px;
  z-index: 5;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(18, 20, 26, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.mycard-x:hover { background: rgba(18, 20, 26, 0.85); }
.mycard-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  padding: 40px;
}
.mycard-spin { animation: mycard-spin 1s linear infinite; color: rgba(255, 255, 255, 0.5); }
@keyframes mycard-spin { to { transform: rotate(360deg); } }

.mycard-enter-active,
.mycard-leave-active { transition: opacity 0.26s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.mycard-enter-from,
.mycard-leave-to { opacity: 0; transform: translateY(0.5%) scale(0.985); }
</style>
