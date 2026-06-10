<script setup lang="ts">
/**
 * Compact leaderboard snapshot for the Vibe screen — shown only once the user
 * has accepted connections (a solo leaderboard isn't interesting). Surfaces the
 * top few standings + the user's own rank, and taps through to the full
 * leaderboard under Network → Orbit.
 */
interface Entry { id: string; name: string; xp: number; level: number; isMe: boolean; rank: number; avatarUrl?: string | null }

const { accepted, loaded, load } = useConnections()
const { nav } = useNavigation()
// Shared with ContactsScreen so we can land directly on the Orbit/leaderboard tab.
const netTab = useState<'contacts' | 'connections'>('cd-net-tab', () => 'contacts')

const entries = ref<Entry[]>([])
const myRank = ref<number | null>(null)
const total = ref(0)
const fetched = ref(false)

async function maybeLoad() {
  if (fetched.value || accepted.value.length === 0) return
  fetched.value = true
  try {
    const r = await $fetch<{ entries: Entry[]; myRank: number | null; total: number }>(
      '/api/network/leaderboard', { query: { window: 'all' } },
    )
    entries.value = r.entries ?? []
    myRank.value = r.myRank
    total.value = r.total ?? 0
  } catch { fetched.value = false }
}

onMounted(async () => {
  if (!loaded.value) await load()
  maybeLoad()
})
watch(() => accepted.value.length, maybeLoad)

const show = computed(() => accepted.value.length > 0 && total.value > 1 && entries.value.length > 0)
const top = computed(() => entries.value.slice(0, 3))
// If the user isn't already in the visible top rows, surface their own row too.
const showMine = computed(() => myRank.value != null && myRank.value > 3)
const mine = computed(() => entries.value.find((e) => e.isMe) ?? null)

function openLeaderboard() {
  netTab.value = 'connections'
  nav('contacts')
}
function medal(rank: number): string | null {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
}
</script>

<template>
  <div v-if="show" class="cd-vc lbc" @click="openLeaderboard">
    <div class="lbc-hdr">
      <span class="lbc-title"><CdIcon emoji="🏆" icon="lucide:trophy" :size="14" /> Leaderboard</span>
      <span v-if="myRank" class="lbc-rank">You're #{{ myRank }} of {{ total }}</span>
    </div>

    <div class="lbc-rows">
      <div v-for="e in top" :key="e.id" class="lbc-row" :class="{ me: e.isMe }">
        <span class="lbc-pos">
          <span v-if="medal(e.rank)">{{ medal(e.rank) }}</span>
          <span v-else>{{ e.rank }}</span>
        </span>
        <span class="lbc-av"><img v-if="e.avatarUrl" :src="e.avatarUrl" alt=""><span v-else>{{ initials(e.name) }}</span></span>
        <span class="lbc-nm">{{ e.isMe ? 'You' : e.name }}</span>
        <span class="lbc-xp">{{ e.xp.toLocaleString() }}</span>
      </div>

      <!-- The user's own row, if they're outside the top 3 shown above -->
      <div v-if="showMine && mine" class="lbc-row me">
        <span class="lbc-pos">{{ mine.rank }}</span>
        <span class="lbc-av"><img v-if="mine.avatarUrl" :src="mine.avatarUrl" alt=""><span v-else>{{ initials(mine.name) }}</span></span>
        <span class="lbc-nm">You</span>
        <span class="lbc-xp">{{ mine.xp.toLocaleString() }}</span>
      </div>
    </div>

    <div class="lbc-foot">
      View full leaderboard <CdIcon icon="lucide:arrow-right" :size="12" />
    </div>
  </div>
</template>

<style scoped>
.lbc { cursor: pointer; border-color: rgba(255, 215, 0, 0.22); }
.lbc-hdr {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;
}
.lbc-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 800; color: var(--cd-gold, #ffd700);
}
.lbc-rank { font-size: 11px; font-weight: 700; color: var(--cd-accent); }
.lbc-rows { display: flex; flex-direction: column; gap: 3px; }
.lbc-row {
  display: flex; align-items: center; gap: 9px; padding: 5px 7px; border-radius: 9px;
}
.lbc-row.me {
  background: rgba(0, 255, 135, 0.08); border: 1px solid rgba(0, 255, 135, 0.22);
}
.lbc-pos {
  width: 20px; flex-shrink: 0; text-align: center; font-weight: 800; font-size: 12px; color: var(--cd-muted);
}
.lbc-av {
  width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 800; color: var(--cd-text);
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
}
.lbc-av img { width: 100%; height: 100%; object-fit: cover; }
.lbc-nm {
  flex: 1; min-width: 0; font-size: 12px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lbc-xp { font-size: 11px; font-weight: 800; color: var(--cd-accent); font-family: monospace; flex-shrink: 0; }
.lbc-foot {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  margin-top: 8px; font-size: 11px; font-weight: 700; color: var(--cd-dim);
}
</style>
