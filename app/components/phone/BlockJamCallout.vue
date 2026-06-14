<script setup lang="ts">
/**
 * Picture Jam launch card for the Play tab. Always available — when a quiet
 * contact exists it hides behind the board (reconnect payoff); otherwise the
 * game falls back to a decorative scene so it's playable any time. The copy
 * adapts to which mode you'll land in. Kept thin — the game lives in
 * BlockJamScreen.vue.
 */
const { contacts, followUpStatus, daysSince } = useContacts()
const { nav } = useNavigation()

const quietCount = computed(() =>
  contacts.value.filter((c) => {
    if (c.hibernated || followUpStatus(c) === 'overdue') return false
    const d = daysSince(c)
    return d === null || d >= 14
  }).length
)
</script>

<template>
  <div class="cd-vc bjc">
    <div class="bjc-hdr">
      <span class="bjc-hdr-ico"><CdIcon emoji="🧩" icon="lucide:puzzle" :size="13" /></span>
      <span>Picture Jam</span>
      <span class="bjc-hdr-tag">Block puzzle</span>
    </div>
    <button class="bjc-btn" type="button" @click="nav('jam')">
      <span class="bjc-ico"><CdIcon emoji="🧩" icon="lucide:puzzle" :size="22" /></span>
      <span class="bjc-copy">
        <span class="bjc-t">{{ quietCount ? 'Blast blocks, uncover a face' : 'Blast blocks, clear a picture' }}</span>
        <span class="bjc-b">{{ quietCount
          ? 'A quiet contact hides behind the board — clear lines to reveal who, then reconnect'
          : 'A relaxing block puzzle — clear lines to reveal the picture behind the board' }}</span>
      </span>
      <CdIcon icon="lucide:play" :size="15" />
    </button>
  </div>
</template>

<style scoped>
.bjc { border-color: color-mix(in srgb, var(--cd-purple, #b87dff) 24%, transparent); }
.bjc-hdr {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--cd-dim); margin-bottom: 9px;
}
.bjc-hdr-ico { color: var(--cd-purple, #b87dff); line-height: 0; }
.bjc-hdr-tag {
  font-size: 8.5px; padding: 1px 6px; border-radius: 999px;
  color: var(--cd-purple, #b87dff);
  background: color-mix(in srgb, var(--cd-purple, #b87dff) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-purple, #b87dff) 26%, transparent);
}
.bjc-btn {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 11px 12px; border-radius: 13px; cursor: pointer; text-align: left;
  background: var(--cd-bg2); border: 1px dashed color-mix(in srgb, var(--cd-purple, #b87dff) 38%, transparent);
  color: var(--cd-text); font-family: inherit;
  transition: transform 0.1s ease, border-color 0.15s ease;
}
.bjc-btn:active { transform: scale(0.98); }
.bjc-ico {
  width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: var(--cd-purple, #b87dff);
  background: color-mix(in srgb, var(--cd-purple, #b87dff) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-purple, #b87dff) 28%, transparent);
}
.bjc-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.bjc-t { font-size: 13.5px; font-weight: 800; }
.bjc-b { font-size: 10.5px; color: var(--cd-dim); font-weight: 600; line-height: 1.4; }
</style>
