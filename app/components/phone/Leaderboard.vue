<script setup lang="ts">
interface Entry { id: string; name: string; xp: number; level: number; isMe: boolean; rank: number; avatarUrl?: string | null }

const entries = ref<Entry[]>([])
const myRank = ref<number | null>(null)
const total = ref(0)
const loading = ref(false)
const window = ref<'all' | 'week'>('all')

onMounted(load)
watch(window, () => load())
async function load() {
  loading.value = true
  try {
    const r = await $fetch<{ entries: Entry[]; myRank: number | null; total: number }>('/api/network/leaderboard', { query: { window: window.value } })
    entries.value = r.entries
    myRank.value = r.myRank
    total.value = r.total
  } catch { /* silent */ } finally { loading.value = false }
}
defineExpose({ reload: load })

function medal(rank: number): string | null {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
}
</script>

<template>
  <div>
    <div class="cd-eyebrow" style="color: var(--cd-muted); margin: 16px 2px 8px; display: flex; justify-content: space-between">
      <span>Leaderboard</span>
      <span v-if="myRank && total > 1" style="color: var(--cd-accent)">You're #{{ myRank }} of {{ total }}</span>
    </div>
    <div class="cd-lb-toggle">
      <button :class="{ on: window === 'all' }" @click="window = 'all'">All-time</button>
      <button :class="{ on: window === 'week' }" @click="window = 'week'">This week</button>
    </div>

    <div v-for="e in entries" :key="e.id" class="cd-lb-row" :class="{ me: e.isMe }">
      <div class="cd-lb-rank">
        <span v-if="medal(e.rank)" style="font-size: 16px">{{ medal(e.rank) }}</span>
        <span v-else>{{ e.rank }}</span>
      </div>
      <div class="cd-lb-av"><img v-if="e.avatarUrl" :src="e.avatarUrl" alt=""><span v-else>{{ initials(e.name) }}</span></div>
      <div style="flex: 1; min-width: 0">
        <div class="cd-cnm">{{ e.isMe ? 'You' : e.name }}</div>
        <div class="cd-csb">Level {{ e.level }}</div>
      </div>
      <div class="cd-lb-xp">{{ e.xp.toLocaleString() }} XP</div>
    </div>
  </div>
</template>

<style scoped>
.cd-lb-toggle {
  display: flex;
  gap: 4px;
  background: var(--cd-bg2);
  border-radius: 9999px;
  padding: 3px;
  margin-bottom: 10px;
}
.cd-lb-toggle button {
  flex: 1;
  border: none;
  background: none;
  color: var(--cd-muted);
  font-size: 11px;
  font-weight: 700;
  padding: 6px;
  border-radius: 9999px;
  cursor: pointer;
}
.cd-lb-toggle button.on {
  background: var(--cd-accent);
  color: #060810;
}
.cd-lb-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  margin-bottom: 4px;
}
.cd-lb-row.me {
  background: rgba(0, 255, 135, 0.08);
  border: 1px solid rgba(0, 255, 135, 0.25);
}
.cd-lb-rank {
  width: 24px;
  text-align: center;
  font-weight: 800;
  font-size: 13px;
  color: var(--cd-muted);
  flex-shrink: 0;
}
.cd-lb-av {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: var(--cd-text);
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  overflow: hidden;
}
.cd-lb-av img { width: 100%; height: 100%; object-fit: cover; }
.cd-lb-xp {
  font-size: 12px;
  font-weight: 800;
  color: var(--cd-accent);
  flex-shrink: 0;
  font-family: monospace;
}
</style>
