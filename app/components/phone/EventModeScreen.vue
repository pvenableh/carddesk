<script setup lang="ts">
/**
 * Event Mode — a focused capture surface for networking events. Reached from the
 * Vibe screen. While active it auto-tags every new contact with the event name,
 * shows a live count + the people met here, and keeps a one-tap "Scan a card"
 * loop going. Built on the shared liquid-glass surfaces + brand-tinted lucide.
 */
const { active, name, captured, count, pastEvents, start, saveAndEnd, loadPastEvents } = useEventMode()
const { nav, goDetail } = useNavigation()
const { open: openChat } = useChat()
const { state: xp } = useXp()

// Hand the past-event snapshots to Earnest AI as a continuable analysis chat.
function analyzeEvents() {
  const events = pastEvents.value.map((ev: any) => {
    const c = ev.messages?.[0]?.content || {}
    return {
      name: ev.title,
      date: ev.date_created,
      count: typeof c.count === 'number' ? c.count : 0,
      contacts: Array.isArray(c.contacts)
        ? c.contacts.slice(0, 12).map((p: any) => ({ name: p.name, company: p.company, title: p.title }))
        : [],
    }
  })
  openChat({
    scope: 'events',
    title: 'Your events',
    context: { events },
    focus: 'their networking event history — the events they\'ve worked and the people they met at each',
    intro: `You've worked ${events.length} ${events.length === 1 ? 'event' : 'events'}. Want me to find who to follow up with first, or spot patterns across them?`,
  })
}

const draftName = ref('')
const summary = ref(false)
const finishing = ref(false)

// Show the user their networking history when they land on the start screen.
onMounted(() => {
  if (!active.value) loadPastEvents()
})

function startEvent() {
  start(draftName.value)
  draftName.value = ''
}
function endEvent() {
  summary.value = true
}
async function finish() {
  if (finishing.value) return
  finishing.value = true
  // Snapshot the event into history before we clear the live state.
  await saveAndEnd()
  finishing.value = false
  summary.value = false
  nav('vibe')
}
function initials(n: string): string {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
}
function eventDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function eventCount(s: any): number {
  const c = s?.messages?.[0]?.content
  return typeof c?.count === 'number' ? c.count : 0
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr">
      <button v-if="active" class="cd-back" @click="endEvent">
        <CdIcon icon="lucide:flag" :size="13" /> End event
      </button>
      <div class="cd-stitle">Event Mode <CdIcon icon="lucide:radio" :size="16" /></div>
    </div>

    <div class="cd-scrl cd-pad">
      <div class="cd-foot-fill">
      <!-- ── Start screen ── -->
      <template v-if="!active">
        <div class="em-start glass-surface">
          <div class="em-start-ico"><CdIcon icon="lucide:users-round" :size="40" /></div>
          <div class="em-start-title">Going to an event?</div>
          <p class="em-start-sub">
            Turn on Event Mode and every card you scan gets tagged to the event automatically.
            Meet fast, sort later — watch your count climb.
          </p>
          <label class="cd-lbl">Event name</label>
          <input
            v-model="draftName"
            class="cd-inp"
            placeholder="SaaS Summit NYC"
            @keyup.enter="startEvent"
          />
          <button class="cd-abtn g em-start-btn" @click="startEvent">
            <CdIcon icon="lucide:play" :size="15" /> Start Event Mode
          </button>
        </div>

        <!-- ── Past events (history) ── -->
        <template v-if="pastEvents.length">
          <div class="em-sec-lbl" style="margin-top: 22px">
            <CdIcon icon="lucide:history" :size="12" /> Your past events
          </div>
          <button class="em-analyze glass-thin" @click="analyzeEvents">
            <span class="em-analyze-ico"><CdIcon icon="lucide:sparkles" :size="18" /></span>
            <span class="em-analyze-copy">
              <span class="em-analyze-title">Analyze my past events</span>
              <span class="em-analyze-sub">Ask Earnest who to follow up with — and spot patterns</span>
            </span>
            <CdIcon icon="lucide:arrow-right" :size="16" />
          </button>
          <div class="em-list">
            <div v-for="ev in pastEvents" :key="ev.id" class="em-row glass-thin" style="cursor: default">
              <span class="em-av"><CdIcon icon="lucide:calendar-check" :size="16" /></span>
              <span class="em-row-info">
                <span class="em-row-name">{{ ev.title }}</span>
                <span class="em-row-co">{{ eventDate(ev.date_created) }} · {{ ev.summary }}</span>
              </span>
              <span class="em-past-count">{{ eventCount(ev) }}</span>
            </div>
          </div>
        </template>
      </template>

      <!-- ── Active capture ── -->
      <template v-else-if="!summary">
        <!-- live count hero -->
        <div class="em-hero glass-surface">
          <div class="em-hero-label">{{ name }}</div>
          <div class="em-hero-count">{{ count }}</div>
          <div class="em-hero-unit">{{ count === 1 ? 'person met here' : 'people met here' }}</div>
          <div class="em-hero-streak">
            <CdIcon icon="lucide:flame" :size="12" /> {{ xp.streak }}-day streak · keep it rolling
          </div>
        </div>

        <!-- primary capture loop -->
        <button class="em-scan glass-surface" @click="nav('add')">
          <span class="em-scan-ico"><CdIcon icon="lucide:scan-line" :size="30" /></span>
          <span class="em-scan-copy">
            <span class="em-scan-title">Scan a card</span>
            <span class="em-scan-sub">+50 XP · auto-tagged to {{ name }}</span>
          </span>
          <CdIcon icon="lucide:arrow-right" :size="18" />
        </button>

        <!-- people met here -->
        <div class="em-sec-lbl">
          <CdIcon icon="lucide:user-check" :size="12" /> Met at this event
        </div>
        <div v-if="!captured.length" class="em-empty">
          No one yet — scan your first card to get the count going.
        </div>
        <div v-else class="em-list">
          <button v-for="c in captured" :key="c.id" class="em-row glass-thin" @click="goDetail(c.id)">
            <span class="em-av">{{ initials(c.name || '?') }}</span>
            <span class="em-row-info">
              <span class="em-row-name">{{ c.name }}</span>
              <span class="em-row-co">{{ [c.title, c.company].filter(Boolean).join(' · ') || '—' }}</span>
            </span>
            <CdIcon icon="lucide:chevron-right" :size="15" />
          </button>
        </div>
      </template>

      <!-- ── End summary ── -->
      <template v-else>
        <div class="em-summary glass-surface">
          <div class="em-summary-ico"><CdIcon icon="lucide:party-popper" :size="52" /></div>
          <div class="em-summary-count">{{ count }}</div>
          <div class="em-summary-title">{{ count === 1 ? 'new connection' : 'new connections' }} at {{ name }}</div>
          <p class="em-summary-sub">Nice work. They're all tagged and waiting in your network — sort them into your pipeline whenever you're ready.</p>
          <button class="cd-abtn g em-start-btn" :disabled="finishing" @click="finish">
            <CdIcon icon="lucide:check" :size="15" /> {{ finishing ? 'Saving…' : 'Done' }}
          </button>
          <p class="em-summary-saved"><CdIcon icon="lucide:bookmark" :size="11" /> Saved to your event history</p>
        </div>
      </template>
      </div>

      <CdBrandFooter />
    </div>
  </div>
</template>

<style scoped>
/* shared frosted glass card */
.glass-surface {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 65% / 0.14) 0%,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 45% / 0.05) 50%,
      hsl(var(--glass-h2, 280) var(--glass-s, 60%) 50% / 0.10) 100%),
    rgba(30, 30, 34, 0.50);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  border: 1px solid hsl(var(--glass-h, 220) 30% 75% / 0.16);
  box-shadow: var(--glass-inset), var(--glass-shadow, 0 12px 30px -18px rgba(0, 0, 0, 0.4));
}
.glass-thin {
  background: rgba(30, 30, 34, 0.4);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid hsl(var(--glass-h, 220) 30% 75% / 0.12);
}

/* start */
.em-start { border-radius: 20px; padding: 26px 20px; text-align: center; }
.em-start-ico { color: var(--cd-green); line-height: 0; margin-bottom: 12px; }
.em-start-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.7rem; color: var(--cd-text); }
.em-start-sub { font-size: 0.9rem; line-height: 1.5; color: var(--cd-muted); margin: 6px 0 16px; }
.em-start .cd-lbl { text-align: left; }
.em-start-btn { width: 100%; justify-content: center; margin-top: 14px; font-size: 15px; padding: 13px; }

/* hero count */
.em-hero { border-radius: 20px; padding: 22px; text-align: center; margin-bottom: 12px; }
.em-hero-label {
  font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.12em; text-transform: uppercase;
  font-size: 0.85rem; color: var(--cd-muted);
}
.em-hero-count {
  font-family: 'Bebas Neue', sans-serif; font-size: 4.6rem; line-height: 0.95; color: var(--cd-accent);
  text-shadow: 0 6px 30px color-mix(in srgb, var(--cd-accent) 40%, transparent);
}
.em-hero-unit { font-size: 0.95rem; color: var(--cd-text); font-weight: 700; margin-top: 2px; }
.em-hero-streak { font-size: 0.78rem; color: var(--cd-orange); font-weight: 700; margin-top: 8px; }

/* scan loop */
.em-scan {
  width: 100%; display: flex; align-items: center; gap: 14px;
  border-radius: 18px; padding: 16px; margin-bottom: 18px; cursor: pointer;
  color: var(--cd-text); text-align: left;
  transition: transform 0.12s ease, box-shadow 0.16s ease;
}
.em-scan:active { transform: scale(0.99); }
.em-scan-ico {
  width: 52px; height: 52px; flex-shrink: 0; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 34%, transparent);
}
.em-scan-copy { flex: 1; display: flex; flex-direction: column; }
.em-scan-title { font-weight: 800; font-size: 1.05rem; }
.em-scan-sub { font-size: 0.78rem; color: var(--cd-muted); }

/* list */
.em-sec-lbl {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800;
  color: var(--cd-dim); margin: 4px 2px 10px;
}
.em-empty { font-size: 0.85rem; color: var(--cd-muted); padding: 8px 2px 20px; }
.em-list { display: flex; flex-direction: column; gap: 8px; }
.em-row {
  display: flex; align-items: center; gap: 11px; width: 100%; text-align: left;
  padding: 11px 12px; border-radius: 14px; cursor: pointer; color: var(--cd-text);
}
.em-av {
  width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.85rem; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
}
.em-row-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.em-row-name { font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.em-row-co { font-size: 0.78rem; color: var(--cd-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* summary */
.em-summary { border-radius: 22px; padding: 30px 22px; text-align: center; }
.em-summary-ico { color: var(--cd-gold, #ffd700); line-height: 0; margin-bottom: 6px; }
.em-summary-count { font-family: 'Bebas Neue', sans-serif; font-size: 5rem; line-height: 0.95; color: var(--cd-accent); }
.em-summary-title { font-size: 1.05rem; font-weight: 800; color: var(--cd-text); }
.em-summary-sub { font-size: 0.9rem; line-height: 1.5; color: var(--cd-muted); margin: 10px 0 4px; }
.em-summary-saved {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  font-size: 0.72rem; color: var(--cd-dim); margin-top: 12px;
}

/* analyze-events CTA */
.em-analyze {
  width: 100%; display: flex; align-items: center; gap: 12px;
  border-radius: 14px; padding: 13px; margin-bottom: 10px; cursor: pointer;
  color: var(--cd-text); text-align: left; transition: transform 0.1s ease, border-color 0.15s;
}
.em-analyze:active { transform: scale(0.99); }
.em-analyze-ico {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 32%, transparent);
}
.em-analyze-copy { flex: 1; display: flex; flex-direction: column; }
.em-analyze-title { font-weight: 800; font-size: 0.95rem; }
.em-analyze-sub { font-size: 0.75rem; color: var(--cd-muted); }

/* past-events count pill */
.em-past-count {
  flex-shrink: 0; min-width: 26px; text-align: center;
  font-family: 'Bebas Neue', sans-serif; font-size: 1.1rem; color: var(--cd-accent);
  padding: 2px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--cd-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 28%, transparent);
}
</style>
