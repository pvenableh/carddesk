<script setup lang="ts">
/**
 * Live QR scanner — point the camera at a code instead of photographing it.
 *
 * The photo path (`capturePhoto` → `decodeImage`) still exists and still has to:
 * it's the fallback whenever the camera stream isn't available (permission
 * denied, an in-app browser that blocks `getUserMedia`, a desktop with no
 * camera), and it's the only path that also feeds the AI card scan. This is the
 * better one when it works — someone holding their phone up with a code on it is
 * a moving target, and taking a still of a moving target is how you end up with
 * a blurry frame that decodes into nothing.
 *
 * Frames are polled on an interval rather than rAF: rAF stops firing when the
 * tab is hidden, and a scanner that silently stops scanning is worse than one
 * that never started.
 */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  /** A code was read. The parent decides what it means. */
  (e: 'found', payload: string): void
  (e: 'close'): void
  /** "Take a photo instead" — the parent runs its normal capture flow. */
  (e: 'fallback'): void
}>()

const { decodeFrame } = useQrDecode()

const video = ref<HTMLVideoElement | null>(null)
const starting = ref(false)
/** Set when the stream can't be had at all — the panel becomes an explanation
 *  plus the photo fallback, rather than a black rectangle. */
const camError = ref<string | null>(null)
/** After a while with nothing found, nudge toward the fallback. */
const struggling = ref(false)
const torchOn = ref(false)
const torchAvailable = ref(false)

let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | null = null
let struggleTimer: ReturnType<typeof setTimeout> | null = null
let decoding = false
/** Guards against emitting twice while the parent is closing us down. */
let done = false

const SCAN_INTERVAL_MS = 220
const STRUGGLE_AFTER_MS = 12000

async function start() {
  camError.value = null
  struggling.value = false
  torchOn.value = false
  torchAvailable.value = false
  done = false

  if (!import.meta.client || !navigator.mediaDevices?.getUserMedia) {
    // Also the http:// case — getUserMedia is gated on a secure context.
    camError.value = "This browser won't give us the camera."
    return
  }

  starting.value = true
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
  } catch (err: any) {
    starting.value = false
    camError.value =
      err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
        ? 'Camera access is off for CardDesk.'
        : err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError'
          ? "We couldn't find a camera on this device."
          : "We couldn't start the camera."
    return
  }

  await nextTick()
  const el = video.value
  if (!el) { stop(); return }
  el.srcObject = stream
  try {
    // iOS needs the explicit play(); it resolves off the tap that opened us.
    await el.play()
  } catch {
    /* autoplay rejection still leaves the frames coming — keep going */
  }
  starting.value = false

  const track = stream.getVideoTracks()[0]
  // Torch is Android-only in practice; iOS Safari exposes no capability for it.
  torchAvailable.value = Boolean((track?.getCapabilities?.() as any)?.torch)

  timer = setInterval(tick, SCAN_INTERVAL_MS)
  struggleTimer = setTimeout(() => { struggling.value = true }, STRUGGLE_AFTER_MS)
}

async function tick() {
  if (done || decoding || !video.value || document.hidden) return
  decoding = true
  try {
    const payload = await decodeFrame(video.value)
    if (payload && !done) {
      done = true
      navigator.vibrate?.(18)
      stop()
      emit('found', payload)
    }
  } catch {
    /* a bad frame is not an error worth surfacing — the next one is 220ms away */
  } finally {
    decoding = false
  }
}

function stop() {
  if (timer) { clearInterval(timer); timer = null }
  if (struggleTimer) { clearTimeout(struggleTimer); struggleTimer = null }
  if (video.value) video.value.srcObject = null
  // Releasing every track is what turns the camera light off. Missing one
  // leaves the phone thinking it's still being recorded.
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  torchOn.value = false
}

async function toggleTorch() {
  const track = stream?.getVideoTracks()[0]
  if (!track) return
  try {
    await track.applyConstraints({ advanced: [{ torch: !torchOn.value }] as any })
    torchOn.value = !torchOn.value
  } catch {
    torchAvailable.value = false
  }
}

function close() {
  stop()
  emit('close')
}

function usePhotoInstead() {
  stop()
  emit('fallback')
}

// `immediate` matters: a parent that mounts this already-open (or re-mounts it
// while open) would otherwise sit on a black rectangle with no camera behind it.
watch(() => props.open, (isOpen) => { isOpen ? start() : stop() }, { immediate: true })
// A backgrounded PWA should not hold the camera open.
onBeforeUnmount(stop)
</script>

<template>
  <Teleport to="body">
    <Transition name="qrs">
      <div v-if="open" class="qrs-ov">
        <button class="qrs-x" type="button" aria-label="Close" @click="close">
          <CdIcon emoji="×" icon="lucide:x" :size="22" />
        </button>

        <!-- Camera unavailable: say which flavour of unavailable, and hand over
             to the photo path rather than dead-ending. -->
        <div v-if="camError" class="qrs-state">
          <CdIcon emoji="📷" icon="lucide:camera-off" :size="30" />
          <div class="qrs-state-msg">{{ camError }}</div>
          <div class="qrs-state-hint">
            You can still photograph the code — it gets read the same way.
          </div>
          <button class="cd-abtn g" style="width: auto; font-size: 13px; padding: 10px 16px" @click="usePhotoInstead">
            <CdIcon emoji="📷" icon="lucide:camera" :size="14" /> Take a photo instead
          </button>
        </div>

        <template v-else>
          <video ref="video" class="qrs-video" playsinline muted autoplay />

          <!-- Reticle. Purely an aiming aid: decoding reads the whole frame, so
               a code slightly outside the box still scans. -->
          <div class="qrs-frame">
            <span class="qrs-c tl" /><span class="qrs-c tr" />
            <span class="qrs-c bl" /><span class="qrs-c br" />
          </div>

          <div class="qrs-copy">
            <div class="qrs-title">{{ starting ? 'Starting camera…' : 'Point At Their QR Code' }}</div>
            <div class="qrs-hint">
              Their digital card, or the code on the back of a printed one — it reads either.
            </div>
          </div>

          <div class="qrs-actions">
            <button v-if="torchAvailable" type="button" class="qrs-btn" @click="toggleTorch">
              <CdIcon emoji="🔦" :icon="torchOn ? 'lucide:flashlight-off' : 'lucide:flashlight'" :size="15" />
              {{ torchOn ? 'Light off' : 'Light on' }}
            </button>
            <button type="button" class="qrs-btn" @click="usePhotoInstead">
              <CdIcon emoji="📷" icon="lucide:camera" :size="15" /> Photo instead
            </button>
          </div>

          <div v-if="struggling" class="qrs-struggle">
            Not catching it? Move closer, or take a photo instead.
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qrs-ov {
  position: fixed;
  inset: 0;
  z-index: 240;
  background: #06070c;
  overflow: hidden;
}
.qrs-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.qrs-x {
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
.qrs-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(66vw, 260px);
  height: min(66vw, 260px);
  transform: translate(-50%, -58%);
  pointer-events: none;
}
.qrs-c {
  position: absolute;
  width: 30px;
  height: 30px;
  /* On a dark camera feed in every theme — --cd-accent goes near-black in
     Glass Light, so this uses the token that stays green throughout. */
  border: 3px solid var(--cd-green, #00ff87);
  border-radius: 4px;
}
.qrs-c.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; }
.qrs-c.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; }
.qrs-c.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; }
.qrs-c.br { bottom: 0; right: 0; border-left: 0; border-top: 0; }
.qrs-copy {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(env(safe-area-inset-top, 0px) + 64px);
  padding: 0 24px;
  text-align: center;
  pointer-events: none;
}
.qrs-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 22px;
  letter-spacing: 1px;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
}
.qrs-hint {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
}
.qrs-actions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 26px);
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 0 20px;
}
.qrs-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 16px;
  border-radius: 999px;
  background: rgba(18, 20, 26, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.qrs-struggle {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 84px);
  text-align: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}
.qrs-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  text-align: center;
  color: rgba(255, 255, 255, 0.72);
}
.qrs-state-msg { font-size: 15px; font-weight: 700; color: #fff; }
.qrs-state-hint { font-size: 12px; max-width: 260px; }

.qrs-enter-active,
.qrs-leave-active { transition: opacity 0.22s ease; }
.qrs-enter-from,
.qrs-leave-to { opacity: 0; }
</style>
