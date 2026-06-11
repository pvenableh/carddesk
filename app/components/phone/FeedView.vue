<script setup lang="ts">
import type { FeedEvent } from '~/composables/useFeed'
import { fmtRelative } from '~/composables/useFormatters'

const { events, loading, load, react } = useFeed()

const broadcast = ref(true)
onMounted(async () => {
  load()
  try {
    const card = await $fetch<{ broadcast_activity: boolean }>('/api/cards/me')
    broadcast.value = card.broadcast_activity ?? true
  } catch { /* */ }
})

async function toggleBroadcast() {
  const next = !broadcast.value
  broadcast.value = next
  try { await $fetch('/api/cards/me', { method: 'PATCH', body: { broadcast_activity: next } }) }
  catch { broadcast.value = !next }
}

const REACTIONS = ['👏', '🔥', '🤝', '🎉', '💡']

const ICON: Record<string, { emoji: string; icon: string }> = {
  card_scanned: { emoji: '📷', icon: 'lucide:scan-line' },
  level_up: { emoji: '🆙', icon: 'lucide:trending-up' },
  streak: { emoji: '🔥', icon: 'lucide:flame' },
  badge: { emoji: '🏅', icon: 'lucide:award' },
  connected: { emoji: '🤝', icon: 'lucide:users' },
  joined: { emoji: '🎉', icon: 'lucide:party-popper' },
  intro: { emoji: '🌉', icon: 'lucide:git-merge' },
  revival: { emoji: '🌅', icon: 'lucide:sunrise' },
}

// Tooltip listing who reacted with an emoji ("You" first). Empty = no tooltip.
function reactorTooltip(e: FeedEvent, emoji: string): string {
  const who = e.reactionUsers?.[emoji] ?? []
  return who.length ? who.join(', ') : ''
}

function text(e: FeedEvent): string {
  const who = e.mine ? 'You' : e.actor.name
  const p = e.payload || {}
  switch (e.type) {
    case 'card_scanned': return `${who} scanned a card${p.company ? ` from ${p.company}` : ''}`
    case 'level_up': return `${who} reached level ${p.level}`
    case 'streak': return `${who} hit a ${p.days}-day streak`
    case 'badge': return `${who} unlocked the ${String(p.badge || '').replace(/_/g, ' ')} badge`
    case 'connected': return `${who} made a new connection`
    case 'joined': return `${who} joined CardDesk`
    case 'intro': return `${who} made an introduction`
    case 'revival': return `${who} revived a sleeping connection`
    default: return `${who} was active`
  }
}
</script>

<template>
  <div class="cd-scrl" style="padding: 4px var(--cd-gutter) 12px">
    <div class="cd-foot-fill">
    <!-- Privacy toggle -->
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px; padding: 11px 13px; margin-bottom: 12px">
      <div>
        <div style="font-size: 12px; font-weight: 700">Share my activity</div>
        <div style="font-size: 10px; color: var(--cd-dim)">Connections see your scans, streaks &amp; level-ups</div>
      </div>
      <button
        class="cd-abtn"
        :class="broadcast ? 'g' : ''"
        style="width: auto; font-size: 11px; padding: 5px 12px; flex-shrink: 0"
        :style="broadcast ? '' : 'background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)'"
        @click="toggleBroadcast"
      >{{ broadcast ? 'On' : 'Off' }}</button>
    </div>

    <div v-if="loading && !events.length" style="text-align: center; color: var(--cd-dim); padding: 30px 0; font-size: 13px">Loading…</div>

    <div v-else-if="!events.length" class="cd-empty">
      <div style="font-size: 40px; margin-bottom: 10px"><CdIcon emoji="📰" icon="lucide:newspaper" :size="40" /></div>
      <div style="font-size: 18px; font-weight: 800; margin-bottom: 6px">No activity yet</div>
      <div style="font-size: 12px; color: var(--cd-dim); max-width: 240px">Scan a card or connect with people — your network's wins show up here.</div>
    </div>

    <div v-for="e in events" :key="e.id" class="cd-feed-item">
      <div class="cd-feed-ic"><CdIcon :emoji="(ICON[e.type] || ICON.card_scanned).emoji" :icon="(ICON[e.type] || ICON.card_scanned).icon" :size="16" /></div>
      <div style="flex: 1; min-width: 0">
        <div style="font-size: 13px; line-height: 1.35">{{ text(e) }}</div>
        <div style="font-size: 10px; color: var(--cd-dim); margin: 2px 0 6px">{{ fmtRelative(e.date) }}</div>
        <div class="cd-feed-reacts">
          <button
            v-for="emoji in REACTIONS"
            :key="emoji"
            class="cd-react"
            :class="{ on: e.myReactions.includes(emoji) }"
            :title="reactorTooltip(e, emoji)"
            @click="react(e.id, emoji)"
          >{{ emoji }}<span v-if="e.reactions[emoji]" class="cd-react-n">{{ e.reactions[emoji] }}</span></button>
        </div>
      </div>
    </div>
    </div>

    <CdBrandFooter />
  </div>
</template>

<style scoped>
.cd-feed-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--cd-bdr);
}
.cd-feed-ic {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--cd-accent) 10%, transparent);
  color: var(--cd-accent);
}
.cd-feed-reacts {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.cd-react {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  padding: 3px 8px;
  border-radius: 9999px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  cursor: pointer;
  line-height: 1;
}
.cd-react.on {
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
  border-color: var(--cd-accent);
}
.cd-react-n {
  font-size: 10px;
  font-weight: 700;
  color: var(--cd-muted);
}
</style>
