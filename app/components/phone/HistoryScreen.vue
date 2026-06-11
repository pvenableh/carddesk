<script setup lang="ts">
/**
 * Chat & session history — the GENERAL, searchable view of everything the user
 * has saved with Earnest: continuable chats plus one-off coaching/insight/note
 * sessions, across all contacts and general threads. Search filters by title,
 * summary, and contact name. Tap a chat to pick it back up; expand others to read.
 * (Per-contact history also lives on each contact's detail screen.)
 */
import type { CdSession } from '~/types/directus'

const { listSessions, deleteSession } = useSessions()
const { resume } = useChat()
const { contacts } = useContacts()
const { nav } = useNavigation()

const sessions = ref<CdSession[]>([])
const loading = ref(true)
const q = ref('')
const expanded = ref<string | null>(null)

const TYPE_META: Record<string, { icon: string; label: string }> = {
  chat: { icon: 'lucide:message-circle', label: 'Chat' },
  coaching: { icon: 'lucide:compass', label: 'Coaching' },
  suggestions: { icon: 'lucide:lightbulb', label: 'Ideas' },
  lead_review: { icon: 'lucide:scan-search', label: 'Lead review' },
  insights: { icon: 'lucide:sparkles', label: 'Insights' },
  note: { icon: 'lucide:sticky-note', label: 'Note' },
  event: { icon: 'lucide:radio', label: 'Event' },
}
function meta(t: string) { return TYPE_META[t] ?? { icon: 'lucide:message-square', label: t } }

function contactName(s: CdSession): string | null {
  if (!s.contact) return null
  if (typeof s.contact === 'object') return (s.contact as any).name ?? null
  return contacts.value.find((c) => c.id === s.contact)?.name ?? null
}

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return sessions.value
  return sessions.value.filter((s) => {
    const hay = [s.title, s.summary, contactName(s)].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(term)
  })
})

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Normalize a saved session's content into readable lines (mirrors DetailScreen).
function lines(s: CdSession): Array<{ who: string; body: string }> {
  const msgs = (s.messages as any[]) || []
  if (s.type === 'chat') {
    return msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ who: m.role === 'user' ? 'You' : 'Earnest', body: typeof m.content === 'string' ? m.content : '' }))
  }
  const msg = msgs.find((m) => m.role === 'assistant') || msgs[0]
  const content = msg?.content
  if (!content) return []
  if (Array.isArray(content)) return content.map((x: any) => ({ who: `${x.icon ?? ''} ${x.title ?? ''}`.trim(), body: x.body ?? '' }))
  if (content.cards) return content.cards.map((c: any) => ({ who: c.q ?? '', body: String(c.b ?? '').replace(/<[^>]+>/g, '') }))
  if (typeof content === 'string') return [{ who: '', body: content }]
  return []
}

function open(s: CdSession) {
  if (s.type === 'chat') {
    // resume() opens the chat as a slide-up panel (useChat().isOpen) over this
    // screen — it is NOT a nav screen, so don't nav('chat').
    resume(s, undefined, s.contact ? 'contact' : 'general')
  } else {
    expanded.value = expanded.value === s.id ? null : s.id
  }
}

async function remove(s: CdSession) {
  if (!confirm('Delete this from your history?')) return
  try { await deleteSession(s.id) } catch { /* non-fatal */ }
  sessions.value = sessions.value.filter((x) => x.id !== s.id)
}

async function load() {
  loading.value = true
  try { sessions.value = await listSessions() }
  catch { sessions.value = [] }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-scrl cd-pad">
      <button class="cd-back" @click="nav('vibe')"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Back</button>
      <div class="cd-shdr"><div class="cd-stitle">History <CdIcon emoji="🕑" icon="lucide:history" /></div></div>

      <input v-model="q" class="cd-inp hs-search" type="search" placeholder="Search chats, contacts, notes…" />

      <div v-if="loading" class="hs-dim">Loading…</div>
      <div v-else-if="!sessions.length" class="hs-empty">
        <CdEarnestMark :size="28" />
        <div class="hs-empty-t">No saved chats yet</div>
        <div class="hs-empty-s">Talk to Earnest from a contact, the Vibe screen, or your score — your conversations show up here.</div>
      </div>
      <div v-else-if="!filtered.length" class="hs-dim">No matches for “{{ q }}”.</div>

      <div v-for="s in filtered" :key="s.id" class="cd-log-sec hs-card">
        <div class="hs-row">
          <button class="hs-main" type="button" @click="open(s)">
            <span class="hs-ico"><CdIcon :icon="meta(s.type).icon" :size="15" /></span>
            <span class="hs-text">
              <span class="hs-title">{{ s.title || meta(s.type).label }}</span>
              <span class="hs-meta">
                <span v-if="contactName(s)" class="cd-pill on hs-who">{{ contactName(s) }}</span>
                <span class="hs-type">{{ meta(s.type).label }}</span>
                <span class="hs-date">{{ fmtDate(s.date_created) }}</span>
              </span>
            </span>
            <CdIcon :icon="s.type === 'chat' ? 'lucide:corner-down-right' : (expanded === s.id ? 'lucide:chevron-down' : 'lucide:chevron-right')" :size="15" class="hs-chev" />
          </button>
          <button class="hs-del" type="button" aria-label="Delete" @click="remove(s)"><CdIcon icon="lucide:trash-2" :size="14" /></button>
        </div>
        <div v-if="expanded === s.id && s.type !== 'chat'" class="hs-body">
          <div v-for="(l, i) in lines(s)" :key="i" class="hs-line">
            <div v-if="l.who" class="hs-who-l">{{ l.who }}</div>
            <div v-if="l.body" class="hs-body-l">{{ l.body }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hs-search { margin: 4px 0 14px; }
.hs-dim { font-size: 13px; color: var(--cd-muted); padding: 8px 2px; }
.hs-empty { text-align: center; padding: 32px 16px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--cd-muted); }
.hs-empty :deep(svg) { color: var(--cd-accent); }
.hs-empty-t { font-weight: 800; color: var(--cd-text); font-size: 15px; margin-top: 4px; }
.hs-empty-s { font-size: 13px; line-height: 1.5; max-width: 280px; }

.hs-card { margin-bottom: 8px; padding: 10px 12px; }
.hs-row { display: flex; align-items: center; gap: 6px; }
.hs-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; background: none; border: 0; cursor: pointer; padding: 0; color: var(--cd-text); font-family: inherit; text-align: left; }
.hs-ico {
  flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: var(--cd-accent); background: color-mix(in srgb, var(--cd-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 26%, transparent);
}
.hs-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.hs-title { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hs-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.hs-who { font-size: 10.5px; padding: 2px 8px; }
.hs-type { font-size: 10.5px; color: var(--cd-muted); }
.hs-date { font-size: 10.5px; color: var(--cd-dim); }
.hs-chev { flex-shrink: 0; color: var(--cd-dim); }
.hs-del { flex-shrink: 0; background: none; border: 0; color: var(--cd-dim); cursor: pointer; padding: 4px; }
.hs-del:hover { color: #e5484d; }

.hs-body { margin-top: 10px; border-top: 1px solid var(--cd-bdr); padding-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.hs-who-l { font-size: 12px; font-weight: 700; }
.hs-body-l { font-size: 12.5px; color: var(--cd-muted); line-height: 1.5; white-space: pre-wrap; }
</style>
