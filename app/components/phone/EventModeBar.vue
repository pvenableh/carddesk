<script setup lang="ts">
/**
 * In-the-moment toolkit shown at the top of the Vibe screen while Event Mode is
 * live. When you're working a room the three things you reach for are: capture
 * the next card, show your own card, and send an invite — so we surface those as
 * big one-tap buttons here instead of leaving them buried in the general rail.
 * Self-hides when no event is running.
 */
const { active, name, count, openPanel } = useEventMode()
const { show: openShareSheet } = useShareSheet()
const { nav } = useNavigation()
</script>

<template>
  <Transition name="cd-emb">
    <div v-if="active" class="cd-emb">
      <button class="cd-emb-hd" type="button" @click="openPanel">
        <span class="cd-emb-live"></span>
        <span class="cd-emb-name">{{ name || 'Event' }}</span>
        <span class="cd-emb-count">{{ count }} met</span>
        <CdIcon icon="lucide:chevron-right" :size="13" />
      </button>
      <div class="cd-emb-acts">
        <button class="cd-emb-act" type="button" @click="nav('add')">
          <CdIcon emoji="📷" icon="lucide:scan" :size="18" />
          <span>Scan a card</span>
        </button>
        <button class="cd-emb-act" type="button" @click="openShareSheet('card')">
          <CdIcon emoji="🪪" icon="lucide:qr-code" :size="18" />
          <span>My card</span>
        </button>
        <button class="cd-emb-act" type="button" @click="openShareSheet('invite')">
          <CdIcon emoji="➕" icon="lucide:user-plus" :size="18" />
          <span>Invite</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cd-emb {
  margin-bottom: 12px;
  padding: 11px 12px 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--cd-accent) 9%, var(--cd-bg2));
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, var(--cd-bdr));
  box-shadow: var(--glass-shadow, 0 18px 40px -22px rgba(0, 0, 0, 0.4));
}
.cd-emb-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 2px 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  color: var(--cd-text);
}
.cd-emb-live {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--cd-accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--cd-accent) 70%, transparent);
  animation: cd-emb-pulse 1.6s ease-in-out infinite;
}
@keyframes cd-emb-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}
.cd-emb-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-size: 12.5px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cd-emb-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 800;
  color: var(--cd-accent);
}
.cd-emb-acts {
  display: flex;
  gap: 8px;
}
.cd-emb-act {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 4px;
  border-radius: 12px;
  background: var(--cd-bg);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 22%, var(--cd-bdr));
  color: var(--cd-text);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.12s;
}
.cd-emb-act :deep(svg) { color: var(--cd-accent); }
.cd-emb-act:hover {
  border-color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 10%, var(--cd-bg));
}
.cd-emb-act:active { transform: scale(0.96); }

.cd-emb-enter-active, .cd-emb-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.cd-emb-enter-from, .cd-emb-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
