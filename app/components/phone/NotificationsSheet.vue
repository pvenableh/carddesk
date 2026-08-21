<script setup lang="ts">
/**
 * The inbox behind the header bell.
 *
 * Deliberately a nudge list, not a message app: every row is something CardDesk
 * asked you to do, so tapping one goes and does it — routes where the push
 * pointed and marks it read on the way. Unread rows carry a dot and a tinted
 * rail; read ones fade back but stay, because "what did that say again?" is the
 * whole reason this exists.
 */
const { items, unread, loading, open, markRead, markAllRead, hide } = useNotifications()
const { nav } = useNavigation()
const router = useRouter()

/** Relative time, to the resolution that actually matters for a nudge. */
function when(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

const ICONS: Record<string, string> = {
  follow_ups: 'lucide:flame',
  streak: 'lucide:zap',
  scan: 'lucide:scan-line',
  invite_accepted: 'lucide:user-plus',
  card_viewed: 'lucide:eye',
  test: 'lucide:bell',
  app_update: 'lucide:sparkles',
}
const iconFor = (kind: string | null) => ICONS[kind || ''] || 'lucide:bell'

/**
 * Go where the notification points. In-app destinations are query-string
 * routes on `/` (the whole app is one page), so anything else is handed to the
 * router as-is.
 */
function openItem(item: { id: string; url: string | null }) {
  markRead(item.id)
  hide()
  const url = item.url || '/'
  if (url === '/' || url.startsWith('/?')) {
    const query = Object.fromEntries(new URLSearchParams(url.split('?')[1] || ''))
    // `go=scan` and friends are handled by the index page's onMounted handler;
    // pushing the query is what re-triggers them.
    if (Object.keys(query).length) router.push({ path: '/', query })
    else nav('home')
    return
  }
  router.push(url)
}
</script>

<template>
  <PhoneSheet :open="open" @update:open="hide">
    <div class="cd-nt-head">
      <div class="cd-nt-title">
        Notifications
        <span v-if="unread" class="cd-nt-count">{{ unread }}</span>
      </div>
      <button v-if="unread" type="button" class="cd-nt-clear" @click="markAllRead">
        Mark all read
      </button>
    </div>

    <div v-if="loading && !items.length" class="cd-nt-empty">
      <div class="cd-nt-spin"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="22" /></div>
    </div>

    <div v-else-if="!items.length" class="cd-nt-empty">
      <CdIcon emoji="🔔" icon="lucide:bell-off" :size="26" />
      <div class="cd-nt-empty-t">Nothing yet</div>
      <div class="cd-nt-empty-b">
        Follow-ups that fall due, streaks about to break and cards scanned on your other devices
        land here — even when notifications are off.
      </div>
    </div>

    <div v-else class="cd-nt-list">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="cd-nt-row"
        :class="{ 'cd-nt-row--unread': !item.read_at }"
        @click="openItem(item)"
      >
        <span class="cd-nt-ico"><CdIcon :icon="iconFor(item.kind)" :size="15" /></span>
        <span class="cd-nt-copy">
          <span class="cd-nt-row-title">{{ item.title }}</span>
          <span v-if="item.body" class="cd-nt-row-body">{{ item.body }}</span>
          <span class="cd-nt-when">{{ when(item.date_created) }}</span>
        </span>
        <span v-if="!item.read_at" class="cd-nt-dot" aria-label="Unread" />
      </button>
    </div>
  </PhoneSheet>
</template>

<style scoped>
.cd-nt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 2px 12px;
}
.cd-nt-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 19px;
  letter-spacing: 1px;
  color: var(--cd-text);
}
.cd-nt-count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--cd-accent);
  color: #04120a;
  font-family: inherit;
  font-size: 12px;
  text-align: center;
}
.cd-nt-clear {
  border: 1px solid var(--cd-bdr);
  background: transparent;
  color: var(--cd-muted);
  border-radius: 999px;
  padding: 6px 12px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.cd-nt-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(62vh, 520px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /* The sheet owns swipe-to-dismiss; scrolling this list must not drag it. */
  overscroll-behavior: contain;
}
.cd-nt-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  background: var(--cd-bg2);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.cd-nt-row--unread {
  border-color: color-mix(in srgb, var(--cd-accent) 40%, var(--cd-bdr));
  background: color-mix(in srgb, var(--cd-accent) 7%, var(--cd-bg2));
}
.cd-nt-ico {
  flex: 0 0 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--cd-muted) 14%, transparent);
  color: var(--cd-muted);
}
.cd-nt-row--unread .cd-nt-ico {
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  color: var(--cd-accent);
}
.cd-nt-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cd-nt-row-title { font-size: 13px; font-weight: 700; color: var(--cd-text); }
.cd-nt-row-body { font-size: 12px; line-height: 1.45; color: var(--cd-muted); }
.cd-nt-when { font-size: 10px; font-weight: 700; color: var(--cd-dim); }
.cd-nt-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--cd-accent);
}
.cd-nt-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 24px 36px;
  text-align: center;
  color: var(--cd-muted);
}
.cd-nt-empty-t { font-size: 14px; font-weight: 700; color: var(--cd-text); }
.cd-nt-empty-b { font-size: 12px; line-height: 1.5; max-width: 300px; }
.cd-nt-spin { animation: cd-nt-spin 1s linear infinite; color: var(--cd-dim); }
@keyframes cd-nt-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .cd-nt-spin { animation: none; }
}
</style>
