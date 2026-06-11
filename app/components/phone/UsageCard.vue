<script setup lang="ts">
/**
 * AI usage summary — tokens used today / this week / this month / lifetime,
 * with credits + call counts. Reads GET /api/usage (aggregated cd_ai_usage_logs).
 * Self-contained card; drop it anywhere (currently the Account page).
 */
interface Bucket { tokens: number; credits: number; calls: number }
interface Usage { today: Bucket; week: Bucket; month: Bucket; lifetime: Bucket }

const usage = ref<Usage | null>(null)
const loading = ref(true)

// Pass LOCAL day/week/month starts (as ISO instants) so buckets match the user's
// timezone rather than the server's UTC day.
function localBoundaries() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const dow = (now.getDay() + 6) % 7 // Monday = 0
  return {
    today: new Date(y, m, d).toISOString(),
    week: new Date(y, m, d - dow).toISOString(),
    month: new Date(y, m, 1).toISOString(),
  }
}

async function load() {
  loading.value = true
  try { usage.value = await $fetch<Usage>('/api/usage', { query: localBoundaries() }) }
  catch { usage.value = null }
  finally { loading.value = false }
}
onMounted(load)

const fmt = (n: number) => (n ?? 0).toLocaleString()
const cells = computed(() =>
  usage.value
    ? [
        { key: 'today', label: 'Today', ...usage.value.today },
        { key: 'week', label: 'This week', ...usage.value.week },
        { key: 'month', label: 'This month', ...usage.value.month },
        { key: 'lifetime', label: 'Lifetime', ...usage.value.lifetime },
      ]
    : [],
)
</script>

<template>
  <div class="uc">
    <div class="uc-hd">
      <span class="uc-title"><CdIcon icon="lucide:activity" :size="14" /> AI usage</span>
      <button class="uc-refresh" type="button" :disabled="loading" aria-label="Refresh" @click="load">
        <CdIcon icon="lucide:refresh-cw" :size="13" :class="{ spin: loading }" />
      </button>
    </div>

    <div v-if="loading && !usage" class="uc-dim">Loading…</div>
    <div v-else-if="!usage" class="uc-dim">Couldn’t load usage — try again.</div>

    <div v-else class="uc-grid">
      <div v-for="c in cells" :key="c.key" class="uc-cell" :class="{ life: c.key === 'lifetime' }">
        <div class="uc-cell-lbl">{{ c.label }}</div>
        <div class="uc-tokens">{{ fmt(c.tokens) }}<span class="uc-unit"> tokens</span></div>
        <div class="uc-sub">{{ fmt(c.credits) }} credit{{ c.credits === 1 ? '' : 's' }} · {{ fmt(c.calls) }} call{{ c.calls === 1 ? '' : 's' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uc {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 14px;
  padding: 14px;
}
.uc-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.uc-title { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 800; color: var(--cd-text); }
.uc-title :deep(svg) { color: var(--cd-green); }
.uc-refresh { background: none; border: 0; color: var(--cd-dim); cursor: pointer; padding: 4px; }
.uc-refresh .spin { animation: uc-spin 0.8s linear infinite; }
@keyframes uc-spin { to { transform: rotate(360deg); } }
.uc-dim { font-size: 12px; color: var(--cd-muted); }

.uc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.uc-cell {
  background: var(--cd-bg);
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  padding: 11px 12px;
}
.uc-cell.life { border-color: color-mix(in srgb, var(--cd-green) 30%, var(--cd-bdr)); }
.uc-cell-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--cd-muted); margin-bottom: 5px; }
.uc-tokens { font-family: 'Bebas Neue', sans-serif; font-size: 26px; line-height: 1; color: var(--cd-text); }
.uc-unit { font-family: inherit; font-size: 11px; color: var(--cd-dim); letter-spacing: 0; }
.uc-sub { font-size: 10.5px; color: var(--cd-dim); margin-top: 4px; font-variant-numeric: tabular-nums; }
</style>
