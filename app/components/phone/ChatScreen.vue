<script setup lang="ts">
/**
 * Full-screen Earnest AI chat. Renders the active conversation from useChat()
 * as a messaging thread — assistant on the left, the user on the right — with
 * suggested prompts on an empty thread, a typing indicator while Earnest
 * replies, and a composer at the bottom. Each send is a metered turn
 * (1 credit). Reached via the contextual helpers (contact / events / score).
 */
const { scope, title, messages, loading, suggestions, send, context, contactId, sessionId, close } = useChat()
const { profile } = useProfile()
const { extractPlan, resolveDrafts } = usePlans()
const { contacts } = useContacts()
const { info, success, error: showError } = useToast()

// The active contact (contact-scoped chats) — used to prefill the mailto. The
// chat context intentionally omits the email, so resolve it from the store.
const chatContact = computed<any>(() =>
  contactId.value ? contacts.value.find((c) => c.id === contactId.value) ?? null : null,
)
const contactEmail = computed<string>(() => (chatContact.value?.email ?? '').trim())

// Strip the light markdown we render (**bold**, `code`, "- " bullets) back to
// clean plain text so a copied/emailed reply doesn't carry asterisks/backticks.
function plain(content: string): string {
  return content
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function copyPlain(content: string) {
  try {
    await navigator.clipboard.writeText(plain(content))
    success('Copied — paste it anywhere.')
  } catch {
    showError("Couldn't copy — select the text manually.")
  }
}

// Open the user's mail client with the contact addressed and the reply as the
// body. Subject stays short and editable; the contact's name/company give it a
// sensible default the user can tweak before sending.
function emailHref(content: string): string {
  const c = chatContact.value
  const subject = c ? `Following up${c.company ? ` — ${c.company}` : ''}` : 'Following up'
  const params = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plain(content))}`
  return `mailto:${contactEmail.value}?${params}`
}

// Best-effort contact name for nicer plan titles (only meaningful in contact scope).
const contactName = computed<string>(
  () => (context.value as any)?.name || (context.value as any)?.contact?.name || (scope.value === 'contact' ? title.value : ''),
)

// "Make this a plan" — turn an assistant reply containing a follow-up sequence
// into saveable, dated tasks. We only surface the button on substantive replies
// (a heuristic) and the server still decides is_plan; non-plans just toast.
function looksActionable(content: string): boolean {
  if (!content || content.length < 130) return false
  return /(^|\n)\s*[-*\d]/.test(content) || /\b(follow[- ]?up|email|linkedin|connect|message|call|coffee|wait|day|week|tuesday|monday|tonight|tomorrow)\b/i.test(content)
}

const extractingIdx = ref<number | null>(null)
const reviewOpen = ref(false)
const reviewTitle = ref('')
const reviewDrafts = ref<any[]>([])

async function makePlan(content: string, idx: number) {
  if (extractingIdx.value !== null) return
  extractingIdx.value = idx
  try {
    const plan = await extractPlan({
      message: content,
      contactId: contactId.value,
      contactName: contactName.value || null,
      sessionId: sessionId.value,
    })
    if (!plan) return // 402 handled upstream
    if (!plan.is_plan || !plan.tasks.length) {
      info('No clear step-by-step plan in that reply — try asking for next steps with timing.')
      return
    }
    reviewTitle.value = plan.title
    reviewDrafts.value = resolveDrafts(plan)
    reviewOpen.value = true
  } finally {
    extractingIdx.value = null
  }
}

// Once the user has sent a turn, drop the priming hints.
const started = computed(() => messages.value.some((m) => m.role === 'user'))

// The awareness primer is collapsed by default — a small, unobtrusive chip the
// user can expand to see exactly what Earnest is grounded in.
const awareOpen = ref(false)

// "What Earnest can see" — derived from the active scope + the context that was
// actually handed to the model, so we never claim awareness Earnest doesn't have.
interface AwareItem { icon: string; label: string }
const awareness = computed<AwareItem[]>(() => {
  const ctx: any = context.value || {}
  const items: AwareItem[] = []
  items.push({
    icon: 'lucide:user-round',
    label: profile.value.networking_goal?.trim()
      ? 'Your profile, role & networking goal'
      : 'Your profile & role',
  })
  if (scope.value === 'contact') {
    items.push({ icon: 'lucide:contact', label: 'This contact — rating, pipeline, notes & your full activity history with them' })
  } else if (scope.value === 'events') {
    items.push({ icon: 'lucide:radio', label: 'Your events & who you met at each' })
  } else if (scope.value === 'score') {
    items.push({ icon: 'lucide:gauge', label: 'Your Earnest Score & each dimension' })
  }
  if (typeof ctx.total_contacts === 'number') {
    const bits = [`${ctx.total_contacts} contact${ctx.total_contacts === 1 ? '' : 's'}`]
    if (ctx.clients) bits.push(`${ctx.clients} client${ctx.clients === 1 ? '' : 's'}`)
    items.push({ icon: 'lucide:users', label: `Your network — ${bits.join(', ')}, ratings & pipeline` })
  }
  if (typeof ctx.streak === 'number' || typeof ctx.level === 'number') {
    items.push({ icon: 'lucide:flame', label: 'Your level, XP & streak' })
  }
  return items
})

const draft = ref('')
const scrollEl = ref<HTMLElement | null>(null)

async function submit() {
  const text = draft.value.trim()
  if (!text || loading.value) return
  draft.value = ''
  await send(text)
}

function useSuggestion(s: string) {
  if (loading.value) return
  draft.value = ''
  send(s)
}

// Lightweight, safe markdown: escape HTML first, then render **bold**, `code`,
// "- " bullets and line breaks. No raw HTML from the model ever reaches v-html.
function render(content: string): string {
  const esc = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = esc.split('\n')
  let html = ''
  let inList = false
  for (const raw of lines) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true }
      html += `<li>${inline(bullet[1])}</li>`
    } else {
      if (inList) { html += '</ul>'; inList = false }
      if (line.trim()) html += `<p>${inline(line)}</p>`
    }
  }
  if (inList) html += '</ul>'
  return html
}
function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function scrollToBottom() {
  nextTick(() => {
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
watch([messages, loading], scrollToBottom, { deep: true })
onMounted(scrollToBottom)
</script>

<template>
  <div class="cd-screen on chat-screen">
    <div class="cd-shdr chat-hdr">
      <button class="cd-back chat-close" type="button" aria-label="Close" @click="close"><CdIcon icon="lucide:x" :size="15" /> Close</button>
      <div class="cd-stitle chat-title"><CdEarnestMark :size="15" /> {{ title }}</div>
    </div>

    <div ref="scrollEl" class="cd-scrl chat-body">
      <!-- Awareness primer: what Earnest can see, until the user's first turn -->
      <div v-if="!started && awareness.length" class="chat-aware" :class="{ open: awareOpen }">
        <button type="button" class="chat-aware-hd" :aria-expanded="awareOpen" @click="awareOpen = !awareOpen">
          <CdEarnestMark :size="12" />
          <span>What Earnest can see</span>
          <CdIcon class="chat-aware-chev" icon="lucide:chevron-down" :size="13" />
        </button>
        <div v-if="awareOpen" class="chat-aware-body">
          <div class="chat-aware-list">
            <div v-for="(a, i) in awareness" :key="i" class="chat-aware-item">
              <CdIcon :icon="a.icon" :size="12" />
              <span>{{ a.label }}</span>
            </div>
          </div>
          <div class="chat-aware-note">
            <CdIcon icon="lucide:lock" :size="10" /> Grounded only in your own CardDesk data — nothing leaves your account.
          </div>
        </div>
      </div>

      <!-- Empty thread → suggested prompts -->
      <div v-if="!messages.length" class="chat-empty">
        <div class="chat-empty-ico"><CdEarnestMark :size="32" /></div>
        <div class="chat-empty-title">Ask Earnest</div>
        <div class="chat-empty-sub">Your networking coach — grounded in your own data. Pick a starter or type your own.</div>
        <div class="chat-sugs">
          <button v-for="s in suggestions" :key="s" class="chat-sug" @click="useSuggestion(s)">{{ s }}</button>
        </div>
      </div>

      <!-- Message thread -->
      <template v-else>
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="chat-msg"
          :class="m.role === 'user' ? 'is-user' : 'is-ai'"
        >
          <div v-if="m.role === 'assistant'" class="chat-ai-badge"><CdEarnestMark :size="13" /></div>
          <div class="chat-bubble-wrap">
            <div class="chat-bubble" v-html="render(m.content)" />
            <div v-if="m.role === 'assistant'" class="chat-msg-acts">
              <button class="chat-msgbtn" type="button" @click="copyPlain(m.content)">
                <CdIcon emoji="📋" icon="lucide:copy" :size="12" /> Copy
              </button>
              <a v-if="contactEmail" class="chat-msgbtn" :href="emailHref(m.content)">
                <CdIcon emoji="📧" icon="lucide:mail" :size="12" /> Email
              </a>
              <button
                v-if="looksActionable(m.content)"
                class="chat-msgbtn"
                type="button"
                :disabled="extractingIdx !== null"
                @click="makePlan(m.content, i)"
              >
                <CdIcon :icon="extractingIdx === i ? 'lucide:loader-2' : 'lucide:flag'" :size="12" :class="{ 'chat-spin': extractingIdx === i }" />
                {{ extractingIdx === i ? 'Building plan…' : 'Make a plan' }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="loading" class="chat-msg is-ai">
          <div class="chat-ai-badge"><CdEarnestMark :size="13" /></div>
          <div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>
        </div>
      </template>
    </div>

    <!-- Composer -->
    <div class="chat-composer">
      <textarea
        v-model="draft"
        class="chat-input"
        rows="1"
        placeholder="Message Earnest…"
        @keydown.enter.exact.prevent="submit"
      ></textarea>
      <button class="chat-send" :disabled="!draft.trim() || loading" @click="submit">
        <CdIcon icon="lucide:arrow-up" :size="18" />
      </button>
    </div>

    <PhonePlanReviewSheet
      :open="reviewOpen"
      :title="reviewTitle"
      :drafts="reviewDrafts"
      :contact-id="contactId"
      :source-session="sessionId"
      @close="reviewOpen = false"
      @saved="reviewOpen = false"
    />
  </div>
</template>

<style scoped>
.chat-screen { display: flex; flex-direction: column; height: 100%; }
.chat-hdr { padding-bottom: 8px; }
/* Back button sits on its own row above the title (display:flex makes the title
   a block that wraps below the inline back button). */
.chat-title { display: flex; align-items: center; gap: 6px; margin-top: 4px; }

.chat-body { flex: 1; padding: 8px var(--cd-gutter) 14px; display: flex; flex-direction: column; gap: 12px; }

/* empty state */
.chat-empty { margin: auto; text-align: center; max-width: 340px; padding: 24px 8px; }
.chat-empty-ico {
  width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 28%, transparent);
}
.chat-empty-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; }
.chat-empty-sub { font-size: 0.88rem; color: var(--cd-muted); line-height: 1.5; margin: 4px 0 16px; }
.chat-sugs { display: flex; flex-direction: column; gap: 8px; }
.chat-sug {
  text-align: left; padding: 11px 14px; border-radius: 14px; cursor: pointer;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text);
  font-size: 0.88rem; font-family: inherit; transition: border-color 0.15s, transform 0.1s;
}
.chat-sug:hover { border-color: var(--cd-accent); }
.chat-sug:active { transform: scale(0.99); }

/* awareness primer — small, collapsible "what Earnest can see" chip */
.chat-aware {
  align-self: flex-start;
  max-width: 100%;
  border: 1px solid var(--cd-bdr);
  background: color-mix(in srgb, var(--cd-accent) 5%, var(--cd-bg2));
  border-radius: 10px;
}
.chat-aware.open {
  align-self: stretch;
}
.chat-aware-hd {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 6px 10px;
  background: none;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--cd-accent);
}
.chat-aware-chev {
  margin-left: auto;
  transition: transform 0.18s ease;
  opacity: 0.7;
}
.chat-aware.open .chat-aware-chev {
  transform: rotate(180deg);
}
.chat-aware-body {
  padding: 0 10px 9px;
}
.chat-aware-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chat-aware-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 0.76rem;
  line-height: 1.3;
  color: var(--cd-text);
}
.chat-aware-item :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--cd-muted);
}
.chat-aware-note {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--cd-bdr);
  font-size: 0.66rem;
  color: var(--cd-dim);
}

/* messages */
.chat-msg { display: flex; align-items: flex-end; gap: 8px; max-width: 100%; }
.chat-msg.is-user { justify-content: flex-end; }
.chat-ai-badge {
  width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
}
.chat-bubble-wrap { display: flex; flex-direction: column; gap: 5px; max-width: 80%; }
.is-user .chat-bubble-wrap { align-items: flex-end; }
.chat-bubble {
  max-width: 100%; padding: 10px 14px; border-radius: 16px; font-size: 0.92rem; line-height: 1.5;
  overflow-wrap: anywhere;
}
/* Copy / Email / Make-a-plan — subtle actions tucked under an assistant reply */
.chat-msg-acts { display: flex; flex-wrap: wrap; gap: 6px; align-self: flex-start; }
.chat-msgbtn {
  display: inline-flex; align-items: center; gap: 5px; text-decoration: none;
  padding: 5px 10px; border-radius: 999px; cursor: pointer;
  background: color-mix(in srgb, var(--cd-accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 28%, transparent);
  color: var(--cd-accent); font-family: inherit; font-size: 0.72rem; font-weight: 700;
  transition: background 0.14s;
}
.chat-msgbtn:hover:not(:disabled) { background: color-mix(in srgb, var(--cd-accent) 18%, transparent); }
.chat-msgbtn:disabled { opacity: 0.55; cursor: default; }
.chat-spin { animation: chat-spin 0.8s linear infinite; }
@keyframes chat-spin { to { transform: rotate(360deg); } }
.is-ai .chat-bubble {
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text);
  border-bottom-left-radius: 5px;
}
.is-user .chat-bubble {
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
  color: var(--cd-text); border-bottom-right-radius: 5px;
}
.chat-bubble :deep(p) { margin: 0 0 6px; }
.chat-bubble :deep(p:last-child) { margin-bottom: 0; }
.chat-bubble :deep(ul) { margin: 4px 0; padding-left: 18px; }
.chat-bubble :deep(li) { margin: 2px 0; }
.chat-bubble :deep(strong) { font-weight: 700; color: var(--cd-text); }
.chat-bubble :deep(code) {
  font-size: 0.85em; background: color-mix(in srgb, var(--cd-text) 8%, transparent);
  padding: 1px 5px; border-radius: 5px;
}

/* typing indicator */
.chat-typing { display: inline-flex; gap: 4px; padding: 14px; }
.chat-typing span {
  width: 7px; height: 7px; border-radius: 50%; background: var(--cd-dim);
  animation: chat-bounce 1.2s infinite ease-in-out;
}
.chat-typing span:nth-child(2) { animation-delay: 0.15s; }
.chat-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes chat-bounce {
  0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
}

/* composer */
.chat-composer {
  flex-shrink: 0; display: flex; align-items: flex-end; gap: 8px;
  padding: 10px 14px calc(env(safe-area-inset-bottom, 8px) + 10px);
  border-top: 1px solid var(--cd-bdr); background: var(--cd-bg);
}
.chat-input {
  flex: 1; resize: none; max-height: 120px; padding: 10px 14px;
  border-radius: 18px; border: 1px solid var(--cd-bdr); background: var(--cd-bg2);
  color: var(--cd-text); font-family: inherit; font-size: 0.92rem; line-height: 1.4; outline: none;
}
.chat-input:focus { border-color: var(--cd-accent); }
.chat-send {
  flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: var(--cd-accent); color: var(--cd-bg); transition: opacity 0.15s, transform 0.1s;
}
.chat-send:hover:not(:disabled) { transform: scale(1.05); }
.chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
