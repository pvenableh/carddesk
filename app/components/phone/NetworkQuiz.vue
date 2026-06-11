<script setup lang="ts">
/**
 * Network IQ — a daily 3-question quiz generated entirely from the user's own
 * contacts (no AI spend). Knowing your network cold *is* the networking skill:
 * remembering who works where, where you met, what they do. Questions are
 * seeded by the date so reloading can't reroll an easier round, and completion
 * is gated server-side via cd_xp_state.quiz_date (same pattern as hype_date).
 *
 * Scoring: +5 for finishing, +15 per correct answer, +25 perfect-round bonus —
 * so a perfect day is +75 XP, and even an 0/3 still pays something (recovery,
 * not punishment, is the house style).
 */
import { INDUSTRIES } from '~/composables/useConstants'
import type { CdContact } from '~/types/directus'

const { contacts } = useContacts()
const { state: xp, earn } = useXp()
const { nav } = useNavigation()

const today = new Date().toISOString().slice(0, 10)
const doneToday = computed(() => xp.value.quiz_date === today)

interface QuizQuestion {
  prompt: string
  options: string[]
  answer: number // index into options
}

// ── Seeded RNG — same questions all day, new ones tomorrow ──
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function dateSeed(): number {
  let h = 0
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) | 0
  return h
}

function shuffled<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const VENUE_DECOYS = ['A conference', 'LinkedIn', 'Through a friend', 'A coffee meetup']

/** Build every askable question from the contact data, then pick 3 (seeded). */
const questions = computed<QuizQuestion[]>(() => {
  const rnd = mulberry32(dateSeed())
  const pool = contacts.value.filter((c) => !c.hibernated && c.name)
  if (pool.length < 4) return []

  const candidates: { contactId: string; q: QuizQuestion }[] = []

  for (const c of pool) {
    // Who works at {company}? — distractors can't share the company.
    if (c.company) {
      const others = pool.filter((o) => o.id !== c.id && o.company !== c.company)
      if (others.length >= 3) {
        const names = shuffled(others, rnd).slice(0, 3).map((o) => o.name)
        const options = shuffled([c.name, ...names], rnd)
        candidates.push({
          contactId: c.id,
          q: { prompt: `Who works at ${c.company}?`, options, answer: options.indexOf(c.name) },
        })
      }
    }
    // Where did you meet {name}?
    if (c.met_at) {
      const venues = [...new Set(pool.map((o) => o.met_at).filter((v): v is string => !!v && v !== c.met_at))]
      const decoys = shuffled([...venues, ...VENUE_DECOYS.filter((d) => d !== c.met_at && !venues.includes(d))], rnd).slice(0, 3)
      if (decoys.length >= 2) {
        const options = shuffled([c.met_at, ...decoys], rnd)
        candidates.push({
          contactId: c.id,
          q: { prompt: `Where did you meet ${c.name}?`, options, answer: options.indexOf(c.met_at) },
        })
      }
    }
    // What's {name}'s title?
    if (c.title) {
      const titles = [...new Set(pool.map((o) => o.title).filter((t): t is string => !!t && t !== c.title))]
      if (titles.length >= 2) {
        const options = shuffled([c.title, ...shuffled(titles, rnd).slice(0, 3)], rnd)
        candidates.push({
          contactId: c.id,
          q: { prompt: `What's ${c.name}'s title?`, options, answer: options.indexOf(c.title) },
        })
      }
    }
    // Which industry is {name} in?
    if (c.industry) {
      const inds = shuffled(INDUSTRIES.filter((i) => i !== c.industry), rnd).slice(0, 3)
      const options = shuffled([c.industry, ...inds], rnd)
      candidates.push({
        contactId: c.id,
        q: { prompt: `Which industry is ${c.name} in?`, options, answer: options.indexOf(c.industry) },
      })
    }
  }

  // Pick 3 with distinct subjects so one contact can't carry the whole round.
  const picked: QuizQuestion[] = []
  const usedContacts = new Set<string>()
  for (const cand of shuffled(candidates, rnd)) {
    if (usedContacts.has(cand.contactId)) continue
    usedContacts.add(cand.contactId)
    picked.push(cand.q)
    if (picked.length === 3) break
  }
  return picked.length === 3 ? picked : []
})

// ── Round state — survives a reload via localStorage so a half-answered round
//    can't be retried with the answers showing. ──
const PROGRESS_KEY = 'cd-quiz-progress'
const answers = ref<number[]>([]) // chosen option index per answered question
const lastScore = ref<number | null>(null)

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null')
    if (saved?.date === today) {
      answers.value = Array.isArray(saved.answers) ? saved.answers : []
      if (typeof saved.score === 'number') lastScore.value = saved.score
    }
  } catch { /* ignore bad cache */ }
})

const current = computed(() => answers.value.length)
const question = computed(() => questions.value[current.value] ?? null)
const correctCount = computed(() =>
  answers.value.filter((a, i) => questions.value[i] && a === questions.value[i].answer).length
)

// Feedback flash between questions
const revealed = ref<number | null>(null) // the option the user just tapped
let advanceTimer: ReturnType<typeof setTimeout> | null = null
onUnmounted(() => { if (advanceTimer) clearTimeout(advanceTimer) })

function saveProgress(score?: number) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ date: today, answers: answers.value, score }))
  } catch { /* quota */ }
}

function pick(idx: number) {
  if (revealed.value !== null || !question.value || doneToday.value) return
  revealed.value = idx
  advanceTimer = setTimeout(() => {
    answers.value = [...answers.value, idx]
    revealed.value = null
    if (answers.value.length >= questions.value.length) {
      finishRound()
    } else {
      saveProgress()
    }
  }, 1100)
}

function finishRound() {
  const correct = correctCount.value
  const perfect = correct === questions.value.length
  const total = 5 + correct * 15 + (perfect ? 25 : 0)
  lastScore.value = correct
  saveProgress(correct)
  earn(
    total,
    perfect ? '🏆' : '🧠',
    perfect ? 'Perfect round — you know your people!' : `Network IQ: ${correct}/${questions.value.length} correct`,
    { quiz_date: today }
  )
}
</script>

<template>
  <div v-if="contacts.length" class="cd-vc nq">
    <div class="nq-hdr">
      <span class="nq-hdr-ico"><CdIcon emoji="🧠" icon="lucide:brain" :size="13" /></span>
      <span>Network IQ</span>
      <span class="nq-hdr-tag">Daily quiz</span>
      <span v-if="questions.length && !doneToday" class="nq-hdr-xp">up to +75 XP</span>
    </div>

    <!-- Locked: not enough contact data to build a round yet -->
    <div v-if="!questions.length" class="nq-locked">
      <CdIcon emoji="🔒" icon="lucide:lock" :size="14" />
      <span>Add a few more contacts (with companies or titles) to unlock the daily quiz.</span>
      <button class="nq-locked-cta" type="button" @click="nav('add')">
        <CdIcon emoji="📷" icon="lucide:scan" :size="12" /> Scan a card
      </button>
    </div>

    <!-- Done for today -->
    <div v-else-if="doneToday" class="nq-done">
      <span class="nq-done-score">{{ lastScore !== null ? `${lastScore}/${questions.length}` : '✓' }}</span>
      <span class="nq-done-msg">
        {{ lastScore === questions.length ? 'Perfect round — you know your people.' : 'Quiz done — fresh questions tomorrow.' }}
      </span>
    </div>

    <!-- Live round -->
    <template v-else-if="question">
      <div class="nq-dots">
        <span
          v-for="(q, i) in questions" :key="i" class="nq-dot"
          :class="{
            done: i < current,
            hit: i < current && answers[i] === questions[i].answer,
            miss: i < current && answers[i] !== questions[i].answer,
            cur: i === current,
          }"
        ></span>
        <span class="nq-dots-lbl">{{ current + 1 }}/{{ questions.length }}</span>
      </div>
      <div class="nq-q">{{ question.prompt }}</div>
      <div class="nq-opts">
        <button
          v-for="(opt, i) in question.options" :key="opt + i"
          class="nq-opt" type="button"
          :class="{
            correct: revealed !== null && i === question.answer,
            wrong: revealed === i && i !== question.answer,
            dim: revealed !== null && revealed !== i && i !== question.answer,
          }"
          :disabled="revealed !== null"
          @click="pick(i)"
        >
          <span class="nq-opt-txt">{{ opt }}</span>
          <CdIcon v-if="revealed !== null && i === question.answer" emoji="✓" icon="lucide:check" :size="13" />
          <CdIcon v-else-if="revealed === i" emoji="✗" icon="lucide:x" :size="13" />
        </button>
      </div>
      <div class="nq-foot">+15 XP per correct · perfect round +25</div>
    </template>
  </div>
</template>

<style scoped>
.nq { border-color: color-mix(in srgb, var(--cd-purple, #b87dff) 26%, transparent); }
.nq-hdr {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--cd-dim); margin-bottom: 9px;
}
.nq-hdr-ico { color: var(--cd-purple, #b87dff); line-height: 0; }
.nq-hdr-tag {
  font-size: 8.5px; padding: 1px 6px; border-radius: 999px;
  color: var(--cd-purple, #b87dff);
  background: color-mix(in srgb, var(--cd-purple, #b87dff) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-purple, #b87dff) 26%, transparent);
}
.nq-hdr-xp { margin-left: auto; color: var(--cd-purple, #b87dff); font-size: 9.5px; }

.nq-dots { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; }
.nq-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--cd-bdr); transition: background 0.2s ease, transform 0.2s ease;
}
.nq-dot.cur { background: var(--cd-purple, #b87dff); transform: scale(1.25); }
.nq-dot.hit { background: var(--cd-accent); }
.nq-dot.miss { background: #f87171; }
.nq-dots-lbl { margin-left: 4px; font-size: 9px; font-weight: 700; color: var(--cd-dim); }

.nq-q { font-size: 14px; font-weight: 800; line-height: 1.4; margin-bottom: 9px; }

.nq-opts { display: flex; flex-direction: column; gap: 6px; }
.nq-opt {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; padding: 9px 12px; border-radius: 11px; cursor: pointer;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
  color: var(--cd-text); font-family: inherit; font-size: 12.5px; font-weight: 700;
  text-align: left; transition: transform 0.1s ease, border-color 0.18s ease, background 0.18s ease, opacity 0.18s ease;
}
.nq-opt:active:not(:disabled) { transform: scale(0.98); }
.nq-opt.correct {
  color: var(--cd-accent);
  border-color: color-mix(in srgb, var(--cd-accent) 50%, transparent);
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
}
.nq-opt.wrong {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.1);
  animation: nq-shake 0.3s ease;
}
.nq-opt.dim { opacity: 0.45; }
.nq-opt-txt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@keyframes nq-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.nq-foot { margin-top: 8px; font-size: 9.5px; color: var(--cd-dim); font-weight: 600; text-align: center; }

.nq-locked {
  display: flex; flex-direction: column; align-items: center; gap: 7px;
  text-align: center; font-size: 11.5px; color: var(--cd-muted); line-height: 1.5;
  padding: 6px 4px 2px;
}
.nq-locked-cta {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 9999px; cursor: pointer;
  background: transparent; border: 1px solid var(--cd-bdr);
  color: var(--cd-purple, #b87dff); font-family: inherit; font-size: 11px; font-weight: 700;
}

.nq-done { display: flex; align-items: center; gap: 10px; padding: 2px 0; }
.nq-done-score {
  flex-shrink: 0; min-width: 40px; height: 40px; padding: 0 8px; border-radius: 12px;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: 'Bebas Neue', sans-serif; font-size: 19px;
  color: var(--cd-purple, #b87dff);
  background: color-mix(in srgb, var(--cd-purple, #b87dff) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-purple, #b87dff) 28%, transparent);
}
.nq-done-msg { font-size: 12px; font-weight: 700; color: var(--cd-muted); line-height: 1.45; }
</style>
