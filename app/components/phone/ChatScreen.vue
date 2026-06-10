<script setup lang="ts">
/**
 * Full-screen Earnest AI chat. Renders the active conversation from useChat()
 * as a messaging thread — assistant on the left, the user on the right — with
 * suggested prompts on an empty thread, a typing indicator while Earnest
 * replies, and a composer at the bottom. Each send is a metered turn
 * (1 credit). Reached via the contextual helpers (contact / events / score).
 */
const { scope, title, messages, loading, suggestions, send } = useChat()
const { nav } = useNavigation()
const router = useRouter()

const draft = ref('')
const scrollEl = ref<HTMLElement | null>(null)

function goBack() {
  switch (scope.value) {
    case 'contact': nav('detail'); break
    case 'events': nav('event'); break
    case 'score': router.push('/account'); break
    default: nav('session')
  }
}

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
      <button class="cd-back" @click="goBack"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Back</button>
      <div class="cd-stitle chat-title"><CdIcon icon="lucide:sparkles" :size="15" /> {{ title }}</div>
    </div>

    <div ref="scrollEl" class="cd-scrl chat-body">
      <!-- Empty thread → suggested prompts -->
      <div v-if="!messages.length" class="chat-empty">
        <div class="chat-empty-ico"><CdIcon icon="lucide:sparkles" :size="34" /></div>
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
          <div v-if="m.role === 'assistant'" class="chat-ai-badge"><CdIcon icon="lucide:sparkles" :size="12" /></div>
          <div class="chat-bubble" v-html="render(m.content)" />
        </div>
        <div v-if="loading" class="chat-msg is-ai">
          <div class="chat-ai-badge"><CdIcon icon="lucide:sparkles" :size="12" /></div>
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
  </div>
</template>

<style scoped>
.chat-screen { display: flex; flex-direction: column; height: 100%; }
.chat-hdr { padding-bottom: 8px; }
.chat-title { display: inline-flex; align-items: center; gap: 6px; }

.chat-body { flex: 1; padding: 8px 14px 14px; display: flex; flex-direction: column; gap: 12px; }

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

/* messages */
.chat-msg { display: flex; align-items: flex-end; gap: 8px; max-width: 100%; }
.chat-msg.is-user { justify-content: flex-end; }
.chat-ai-badge {
  width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
}
.chat-bubble {
  max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 0.92rem; line-height: 1.5;
  overflow-wrap: anywhere;
}
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
