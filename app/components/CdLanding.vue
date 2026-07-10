<script setup lang="ts">
/**
 * CdLanding — marketing landing shown at the bare domain (carddesk.earnest.guru)
 * for logged-out visitors. Built on the app's liquid-glass design system: it
 * inherits the active palette tint + dark/light glass from <html> (app.vue runs
 * initTheme/initPalette for everyone), and reuses the shared glass tokens
 * (--glass-shadow / --glass-inset / --glass-blur, --cd-chrome-*) so the chrome,
 * widget borders, and soft drop shadows match the rest of CardDesk exactly.
 * Titles use Bebas Neue; Gaegu is used only for playful encouragement microcopy.
 * Rendered by pages/index.vue when there's no session.
 */
// Contextual-awareness chips shown inside the Earnest AI callout visual — they
// demonstrate that the AI reads both sides of a card and remembers the context.
const aiChips = [
  { icon: 'lucide:map-pin', emoji: '📍', label: 'Met at SaaStr ’26' },
  { icon: 'lucide:briefcase', emoji: '💼', label: 'VP Product · Lumen' },
  { icon: 'lucide:sparkles', emoji: '🌱', label: 'Worth nurturing' },
]

// Sample friends leaderboard for the "compete with friends" spotlight. You sit
// at #2, 160 XP behind Maya — close enough to feel the chase (the handwriting
// microcopy references that exact gap).
const leaderboard = [
  { rank: 1, name: 'Maya C.', xp: 2640, streak: 9, tint: 'var(--cd-gold)' },
  { rank: 2, name: 'You', xp: 2480, streak: 12, tint: 'var(--cd-green)', you: true },
  { rank: 3, name: 'Devin B.', xp: 2210, streak: 5, tint: 'var(--cd-ice)' },
  { rank: 4, name: 'Emily C.', xp: 1990, streak: 7, tint: 'var(--cd-palette-primary, #4da6ff)' },
  { rank: 5, name: 'Alex R.', xp: 1640, streak: 3, tint: 'var(--cd-orange)' },
]

// Hero deck — a small stack of cards that slowly flips through sample contacts.
// Each card carries a level + XP so the hero visual reads as "a gamified card",
// echoing the headline without leaning on the Orbit (saved for its own section).
const heroCards = [
  { name: 'Sarah Johnson', role: 'Founder · Northwind', email: 'sarah@northwind.co', phone: '(415) 555-0199', tint: 'var(--cd-palette-primary, #4da6ff)', level: 7, xp: 820, xpMax: 1000 },
  { name: 'Maya Chen', role: 'Product Lead · Lumen', email: 'maya@lumen.io', phone: '(212) 555-0148', tint: 'var(--cd-green)', level: 9, xp: 410, xpMax: 1100 },
  { name: 'Devin Brooks', role: 'Designer · Foundry', email: 'devin@foundry.studio', phone: '(646) 555-0173', tint: 'var(--cd-gold)', level: 5, xp: 660, xpMax: 800 },
  { name: 'Emily Carter', role: 'VP Sales · Beacon', email: 'emily@beacon.co', phone: '(312) 555-0186', tint: 'var(--cd-orange)', level: 8, xp: 940, xpMax: 1000 },
]
// First two initials of a name, for the card avatar (richer than a generic icon).
const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const activeHero = ref(0)
let heroTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  // Respect reduced-motion: hold on the first card rather than auto-flipping.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  heroTimer = setInterval(() => {
    activeHero.value = (activeHero.value + 1) % heroCards.length
  }, 4200)
})
onUnmounted(() => { if (heroTimer) clearInterval(heroTimer) })

// Scroll-driven UI:
//  • giant faint keyword watermarks drift behind each callout,
//  • the closing-CTA title rises up from behind its frosted card,
//  • a floating CTA pill fades in once you scroll past the hero and hands off
//    to the real CTA button as it comes into view at the bottom.
// All driven from one rAF-throttled scroll handler. The watermark / title drift
// is transform-only (compositor-cheap) and skipped for reduced-motion; the
// floating CTA still works for everyone (it just fades rather than slides).
const ctaWrap = ref<HTMLElement | null>(null)
const heroRef = ref<HTMLElement | null>(null)
const floatCta = ref<'hidden' | 'shown' | 'docked'>('hidden')
let parallaxRaf = 0
let onParallax: (() => void) | undefined
onMounted(() => {
  const motionOK = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const cta = ctaWrap.value
  const ctaBtn = cta?.querySelector<HTMLElement>('.lp-btn')
  const hero = heroRef.value
  const ghosts = motionOK
    ? Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'))
    : []
  const update = () => {
    parallaxRaf = 0
    const vh = window.innerHeight || 1

    // Floating CTA state: hidden over the hero, shown once it's mostly scrolled
    // off, then docked (handed off) the moment the real CTA button enters from
    // the bottom — so it reads as merging into it rather than vanishing early.
    if (hero) {
      const heroR = hero.getBoundingClientRect()
      const btnTop = ctaBtn?.getBoundingClientRect().top ?? Infinity
      floatCta.value = btnTop < vh * 0.92 ? 'docked'
        : heroR.bottom < vh * 0.5 ? 'shown'
        : 'hidden'
    }

    if (!motionOK) return

    // Section keyword watermarks (incl. the closing "LET'S PLAY" title): a gentle
    // drift mapped across each ghost host's FULL travel through the viewport —
    // from just before it enters (host top at the viewport bottom) to just after
    // it exits (host bottom at the top). The progress is deliberately left
    // unclamped so the motion starts before the watermark scrolls in and keeps
    // easing after it's gone — no snap or freeze at either edge. Amplitude (px of
    // total travel) comes from data-parallax (default 260).
    for (const g of ghosts) {
      const host = g.parentElement
      if (!host) continue
      const r = host.getBoundingClientRect()
      const range = Number(g.dataset.parallax) || 260
      const p = (vh - r.top) / (vh + r.height)
      g.style.setProperty('--lp-shift', `${((0.5 - p) * range).toFixed(1)}px`)
    }
  }
  onParallax = () => { if (!parallaxRaf) parallaxRaf = requestAnimationFrame(update) }
  window.addEventListener('scroll', onParallax, { passive: true })
  window.addEventListener('resize', onParallax, { passive: true })
  update()
})
onUnmounted(() => {
  if (onParallax) {
    window.removeEventListener('scroll', onParallax)
    window.removeEventListener('resize', onParallax)
  }
  if (parallaxRaf) cancelAnimationFrame(parallaxRaf)
})
</script>

<template>
  <div class="lp">
    <!-- ═══ Top bar ═══ -->
    <header class="lp-nav">
      <div class="lp-wordmark"><span class="lp-wm-a">CARD</span><span class="lp-wm-b">DESK</span></div>
      <nav class="lp-nav-actions">
        <NuxtLink to="/login" class="lp-signin">Sign in</NuxtLink>
        <NuxtLink to="/auth/register" class="lp-btn lp-btn-sm">Get started free</NuxtLink>
      </nav>
    </header>

    <!-- ═══ Hero ═══ -->
    <section ref="heroRef" class="lp-hero">
      <div class="lp-hero-copy">
        <div class="lp-eyebrow">Your network. Gamified.</div>
        <h1 class="lp-h1">Networking, but&nbsp;make&nbsp;it a&nbsp;<span class="lp-grad">game</span>.</h1>
        <p class="lp-sub">
          Turn the business cards piling up in your pocket into XP, streaks, and real relationships.
          CardDesk makes meeting people genuinely fun — with Earnest AI doing the heavy lifting.
        </p>

        <div class="lp-token-badge">
          <CdIcon emoji="✨" icon="lucide:sparkles" :size="15" />
          <span><strong>25 Earnest AI tokens</strong> free when you start</span>
        </div>

        <div class="lp-cta-row">
          <NuxtLink to="/auth/register" class="lp-btn lp-btn-lg lp-btn-game">
            Start free <CdIcon emoji="→" icon="lucide:arrow-right" :size="17" />
          </NuxtLink>
          <NuxtLink to="/login" class="lp-btn-ghost">I already have an account</NuxtLink>
        </div>
        <p class="lp-hand">no credit card — your first 25 tokens are on us ✨</p>
      </div>

      <!-- Hero visual: a slow flip-through deck of cards + floating chips, set
           against a faint orbit-ring halo that hints at the Orbit system. -->
      <div class="lp-hero-art" aria-hidden="true">
        <!-- Faint concentric rings + drifting dots — a whisper of the Orbit
             section below, kept low-contrast so the card stays the hero. -->
        <svg class="lp-hero-rings" viewBox="-160 -160 320 320" preserveAspectRatio="xMidYMid meet">
          <circle class="lp-ring" r="58" />
          <circle class="lp-ring" r="104" />
          <circle class="lp-ring" r="150" />
          <g class="lp-ring-orbit lp-ring-orbit-1"><circle class="lp-ring-dot" cx="104" cy="0" r="4.5" /></g>
          <g class="lp-ring-orbit lp-ring-orbit-2"><circle class="lp-ring-dot" cx="-58" cy="0" r="3.5" /></g>
          <g class="lp-ring-orbit lp-ring-orbit-3"><circle class="lp-ring-dot" cx="150" cy="0" r="3.5" /></g>
        </svg>

        <div class="lp-deck">
          <!-- static cards peeking out behind, for depth -->
          <div class="lp-card lp-card-ghost lp-card-ghost-2" />
          <div class="lp-card lp-card-ghost lp-card-ghost-1" />
          <!-- front card slowly flips through sample contacts -->
          <Transition name="lp-flip" mode="out-in">
            <div :key="activeHero" class="lp-card lp-card-front">
              <!-- tint accent strip keyed to the active contact -->
              <span
                class="lp-card-accent"
                :style="{ background: heroCards[activeHero].tint }"
              />
              <div class="lp-card-top">
                <div
                  class="lp-card-avatar"
                  :style="{ background: `color-mix(in srgb, ${heroCards[activeHero].tint} 18%, transparent)`, color: heroCards[activeHero].tint }"
                >{{ initials(heroCards[activeHero].name) }}</div>
                <div class="lp-card-id">
                  <div class="lp-card-name">{{ heroCards[activeHero].name }}</div>
                  <div class="lp-card-role">{{ heroCards[activeHero].role }}</div>
                </div>
                <div class="lp-card-level" :style="{ color: heroCards[activeHero].tint }">
                  Lv {{ heroCards[activeHero].level }}
                </div>
              </div>
              <div class="lp-card-rows">
                <div class="lp-card-line"><CdIcon emoji="✉️" icon="lucide:mail" :size="13" /> {{ heroCards[activeHero].email }}</div>
                <div class="lp-card-line"><CdIcon emoji="📞" icon="lucide:phone" :size="13" /> {{ heroCards[activeHero].phone }}</div>
              </div>
              <div class="lp-card-foot">
                <div class="lp-card-qr"><CdIcon emoji="🔳" icon="lucide:qr-code" :size="34" /></div>
                <div class="lp-card-xp">
                  <div class="lp-card-xp-head"><span>XP</span><span>{{ heroCards[activeHero].xp }} / {{ heroCards[activeHero].xpMax }}</span></div>
                  <div class="lp-card-xp-track">
                    <div
                      class="lp-card-xp-fill"
                      :style="{ width: (heroCards[activeHero].xp / heroCards[activeHero].xpMax * 100) + '%', background: heroCards[activeHero].tint }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <div class="lp-chip lp-chip-xp">+50 XP</div>
        <div class="lp-chip lp-chip-streak"><CdIcon emoji="🔥" icon="lucide:flame" :size="13" /> 7-day streak</div>
        <div class="lp-chip lp-chip-orbit"><CdIcon emoji="🪐" icon="lucide:orbit" :size="13" /> +1 to Orbit</div>
      </div>
    </section>

    <!-- ═══ Why it's different — a rhythm of featured callouts ═══ -->
    <section class="lp-section">
      <div class="lp-section-head lp-section-head--quote">
        <div class="lp-head-ghost" data-parallax="150" aria-hidden="true">Why it’s different</div>
        <h2 class="lp-h2 lp-h2-script">“Everything about meeting people, made fun.”</h2>
      </div>

      <!-- Callout 1 · Gamify — copy left, reward visual right -->
      <div class="lp-callout">
        <div class="lp-ghost" data-parallax aria-hidden="true">FUN</div>
        <div class="lp-callout-copy">
          <div class="lp-eyebrow">Networking, gamified</div>
          <h3 class="lp-callout-h">Every scan throws <span class="lp-grad">confetti</span>.</h3>
          <p class="lp-callout-body">
            Earn XP for every card you scan and contact you save. Level up, chase a weekly
            goal, and clear daily missions that complete themselves when you do the real
            thing — and if life happens, a streak shield saves your run. Follow-ups become
            a game you actually want to win.
          </p>
          <p class="lp-hand">+50 XP, just like that 🎉</p>
        </div>

        <div class="lp-callout-art" aria-hidden="true">
          <div class="lp-gamify lp-glass">
            <svg class="lp-confetti" viewBox="0 0 320 80" preserveAspectRatio="none">
              <rect class="lp-cf" x="30" y="10" width="8" height="8" rx="1.5" fill="var(--cd-green)" />
              <circle class="lp-cf" cx="80" cy="16" r="4" fill="var(--cd-gold)" />
              <rect class="lp-cf" x="130" y="8" width="7" height="7" rx="1.5" fill="var(--cd-palette-primary, #4da6ff)" />
              <circle class="lp-cf" cx="185" cy="18" r="4" fill="var(--cd-orange)" />
              <rect class="lp-cf" x="225" y="10" width="8" height="8" rx="1.5" fill="var(--cd-ice)" />
              <circle class="lp-cf" cx="280" cy="14" r="4" fill="var(--cd-green)" />
              <rect class="lp-cf" x="55" y="30" width="6" height="6" rx="1.5" fill="var(--cd-orange)" />
              <circle class="lp-cf" cx="160" cy="32" r="3.5" fill="var(--cd-gold)" />
              <rect class="lp-cf" x="250" y="30" width="6" height="6" rx="1.5" fill="var(--cd-palette-primary, #4da6ff)" />
            </svg>

            <div class="lp-gamify-xp">+50 XP</div>

            <div class="lp-gamify-bar">
              <div class="lp-gamify-bar-head"><span>Level 7</span><span>820 / 1000 XP</span></div>
              <div class="lp-gamify-track"><div class="lp-gamify-fill" /></div>
            </div>

            <div class="lp-gamify-chips">
              <span class="lp-gchip lp-gchip-streak"><CdIcon emoji="🔥" icon="lucide:flame" :size="13" /> 7-day streak</span>
              <span class="lp-gchip lp-gchip-shield"><CdIcon emoji="🛡️" icon="lucide:shield" :size="13" /> shield ×2</span>
              <span class="lp-gchip lp-gchip-orbit"><CdIcon emoji="🪐" icon="lucide:orbit" :size="13" /> +1 to Orbit</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Callout 2 · Earnest AI — visual left, copy right -->
      <div class="lp-callout lp-callout-rev">
        <div class="lp-ghost" data-parallax aria-hidden="true">MOVE</div>
        <div class="lp-callout-copy">
          <div class="lp-eyebrow">Earnest AI in your corner</div>
          <h3 class="lp-callout-h">It already knows your <span class="lp-grad">next move</span>.</h3>
          <p class="lp-callout-body">
            Earnest AI reads both sides of every card, remembers where you met and what you
            talked about, then drafts the follow-up — even the “it’s been a while” re-opener
            — and surfaces the connections worth nurturing. The right move is always one
            tap away.
          </p>
          <p class="lp-hand">context in, follow-up out ✨</p>
        </div>

        <div class="lp-callout-art" aria-hidden="true">
          <div class="lp-ai lp-glass">
            <div class="lp-ai-head">
              <span class="lp-ai-badge"><CdIcon emoji="🧠" icon="lucide:sparkles" :size="15" /> Earnest AI</span>
              <span class="lp-ai-reading"><CdIcon emoji="🔍" icon="lucide:scan-line" :size="12" /> read front + back</span>
            </div>

            <div class="lp-ai-context">
              <span v-for="c in aiChips" :key="c.label" class="lp-ai-chip">
                <CdIcon :emoji="c.emoji" :icon="c.icon" :size="12" /> {{ c.label }}
              </span>
            </div>

            <div class="lp-ai-draft">
              <div class="lp-ai-draft-label">Suggested follow-up</div>
              <p class="lp-ai-draft-body">
                Hi Maya — loved your take on onboarding flows. Want to grab coffee before you
                fly out Thursday?
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Callout 3 · Orbit — copy left, live showcase right -->
      <div class="lp-callout lp-callout--orbit">
        <div class="lp-ghost" data-parallax aria-hidden="true">ORBIT</div>
        <div class="lp-callout-copy">
          <div class="lp-eyebrow">Your own Orbit</div>
          <h3 class="lp-callout-h">Your whole network, orbiting <span class="lp-grad">you</span>.</h3>
          <p class="lp-callout-body">
            Everyone you meet pulls into your personal Orbit — a living map of your network.
            Contacts ride along as dim dots; the people playing CardDesk with you light up
            as planets. Tap a dot to invite them in — color shows their industry, size shows
            how active they are.
          </p>
          <p class="lp-hand">tap a dim dot — light them up ✨</p>
        </div>

        <div class="lp-callout-art">
          <ClientOnly>
            <OrbitShowcase />
          </ClientOnly>
        </div>
      </div>

      <!-- Callout 4 · Daily games — quiz visual left, copy right -->
      <div class="lp-callout lp-callout-rev">
        <div class="lp-ghost" data-parallax aria-hidden="true">PLAY</div>
        <div class="lp-callout-copy">
          <div class="lp-eyebrow">Daily games, real XP</div>
          <h3 class="lp-callout-h">Your network is the <span class="lp-grad">game board</span>.</h3>
          <p class="lp-callout-body">
            Network IQ quizzes you on your own contacts — who works where, where you met —
            three fresh questions a day. Then Reconnect Roulette spins up someone going
            quiet and dares you to reach out (Earnest will even draft the opener). Knowing
            your people pays.
          </p>
          <p class="lp-hand">3 questions a day · up to +75 XP 🧠</p>
        </div>

        <div class="lp-callout-art" aria-hidden="true">
          <div class="lp-quiz lp-glass">
            <div class="lp-quiz-head">
              <span class="lp-quiz-badge"><CdIcon emoji="🧠" icon="lucide:brain" :size="15" /> Network IQ</span>
              <span class="lp-quiz-tag">daily quiz</span>
            </div>
            <div class="lp-quiz-dots"><span class="hit" /><span class="hit" /><span class="cur" /></div>
            <div class="lp-quiz-q">Who works at Lumen?</div>
            <div class="lp-quiz-opt lp-quiz-correct"><span>Maya Chen</span><CdIcon emoji="✓" icon="lucide:check" :size="14" /></div>
            <div class="lp-quiz-opt"><span>Alex Rivera</span></div>
            <div class="lp-quiz-opt"><span>Emily Carter</span></div>
            <div class="lp-quiz-foot">
              <span class="lp-quiz-xp">+15 XP</span>
              <span class="lp-quiz-roulette"><CdIcon emoji="🎰" icon="lucide:dices" :size="13" /> Roulette: 2 spins left</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Callout 5 · Event Mode — copy left, live-count visual right -->
      <div class="lp-callout">
        <div class="lp-ghost" data-parallax aria-hidden="true">EVENT</div>
        <div class="lp-callout-copy">
          <div class="lp-eyebrow">Event Mode</div>
          <h3 class="lp-callout-h">Work the room. Watch the <span class="lp-grad">count climb</span>.</h3>
          <p class="lp-callout-body">
            At a conference? Flip on Event Mode and it rides along on every screen — each
            card you scan is auto-tagged to the event, the live counter ticks up, and the
            whole night lands in your history. Meet fast, sort later.
          </p>
          <p class="lp-hand">scan → next → scan → next 📡</p>
        </div>

        <div class="lp-callout-art" aria-hidden="true">
          <div class="lp-event lp-glass">
            <div class="lp-event-pill">
              <span class="lp-event-live" /> SaaS Summit NYC
              <span class="lp-event-met">14 met</span>
            </div>
            <div class="lp-event-num">14</div>
            <div class="lp-event-unit">people met here</div>
            <div class="lp-event-scan">
              <CdIcon emoji="📷" icon="lucide:scan-line" :size="16" />
              <span class="lp-event-scan-t">Scan a card</span>
              <span class="lp-event-scan-s">+50 XP · auto-tagged</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Callout 6 · Compete — leaderboard left, copy right -->
      <div class="lp-callout lp-callout-rev">
        <div class="lp-ghost" data-parallax aria-hidden="true">COMPETE</div>
        <div class="lp-callout-copy">
          <div class="lp-eyebrow">Compete with your circle</div>
          <h3 class="lp-callout-h">Climb the board. Earn the <span class="lp-grad">bragging rights</span>.</h3>
          <p class="lp-callout-body">
            Networking’s better with rivals. Add the friends and colleagues you actually
            network with and you’ll all share a leaderboard — compare XP, streaks, and who’s
            really working the room. Nothing makes you send the follow-up quite like watching
            a friend pass you.
          </p>
          <p class="lp-hand">Maya’s only 160 XP ahead 👀</p>
          <div class="lp-cta-row lp-callout-cta">
            <NuxtLink to="/auth/register" class="lp-btn lp-btn-lg">
              Start climbing <CdIcon emoji="→" icon="lucide:arrow-right" :size="17" />
            </NuxtLink>
          </div>
        </div>

        <div class="lp-callout-art" aria-hidden="true">
          <div class="lp-board lp-glass">
            <div class="lp-board-head">
              <span class="lp-board-title"><CdIcon emoji="🏆" icon="lucide:trophy" :size="16" /> Friends · this week</span>
              <span class="lp-board-tag">XP</span>
            </div>
            <div class="lp-board-rows">
              <div v-for="r in leaderboard" :key="r.name" class="lp-row" :class="{ 'lp-row-you': r.you }">
                <span class="lp-rank" :class="`lp-rank-${r.rank}`">{{ r.rank }}</span>
                <span class="lp-ava" :style="{ background: `color-mix(in srgb, ${r.tint} 20%, transparent)`, color: r.tint }">{{ r.name[0] }}</span>
                <span class="lp-row-name">{{ r.name }}<span v-if="r.you" class="lp-you-tag">you</span></span>
                <span class="lp-row-streak"><CdIcon emoji="🔥" icon="lucide:flame" :size="13" /> {{ r.streak }}</span>
                <span class="lp-row-xp">{{ r.xp.toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Callout 7 · Your card — copy left, card visual right -->
      <div class="lp-callout">
        <div class="lp-ghost" data-parallax aria-hidden="true">SHARE</div>
        <div class="lp-callout-copy">
          <div class="lp-eyebrow">A card that’s all you</div>
          <h3 class="lp-callout-h">Share yourself in <span class="lp-grad">one tap</span>.</h3>
          <p class="lp-callout-body">
            Build a personalized digital business card and share it with a tap or a QR scan.
            No app required on their end — just a link that makes you look sharp.
          </p>
          <p class="lp-hand">no app on their end ✨</p>
        </div>

        <div class="lp-callout-art" aria-hidden="true">
          <div class="lp-cardviz lp-glass">
            <div class="lp-cardviz-top">
              <div class="lp-cardviz-avatar"><CdIcon emoji="🙂" icon="lucide:user-round" :size="24" /></div>
              <div>
                <div class="lp-cardviz-name">Jordan Lee</div>
                <div class="lp-cardviz-role">Founder · Studio North</div>
              </div>
            </div>
            <div class="lp-cardviz-rows">
              <div class="lp-cardviz-line"><CdIcon emoji="✉️" icon="lucide:mail" :size="13" /> jordan@studionorth.co</div>
              <div class="lp-cardviz-line"><CdIcon emoji="🔗" icon="lucide:link" :size="13" /> studionorth.co</div>
            </div>
            <div class="lp-cardviz-foot">
              <div class="lp-cardviz-qr"><CdIcon emoji="🔳" icon="lucide:qr-code" :size="40" /></div>
              <span class="lp-cardviz-tap"><CdIcon emoji="👆" icon="lucide:smartphone-nfc" :size="14" /> tap to share</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Callout 8 · Coaching — coaching chat left, copy right -->
      <div class="lp-callout lp-callout-rev">
        <div class="lp-ghost" data-parallax aria-hidden="true">HYPE</div>
        <div class="lp-callout-copy">
          <div class="lp-eyebrow">Coaching sessions with Earnest AI</div>
          <h3 class="lp-callout-h">A coach in your <span class="lp-grad">corner</span>.</h3>
          <p class="lp-callout-body">
            Low on momentum? Run a session with Earnest AI for fresh outreach ideas and a hit
            of motivation — hype yourself up, or take a tough-love nudge to actually follow
            through.
          </p>
          <p class="lp-hand">hype or tough love — your call 💪</p>
        </div>

        <div class="lp-callout-art" aria-hidden="true">
          <div class="lp-coach lp-glass">
            <div class="lp-coach-head">
              <span class="lp-coach-badge"><CdIcon emoji="🧠" icon="lucide:sparkles" :size="15" /> Earnest AI · coaching</span>
              <span class="lp-coach-tag">session</span>
            </div>
            <div class="lp-coach-bubble">
              You’ve got 3 follow-ups sitting cold. Let’s knock out two before lunch — I’ll draft them, you hit send. 💪
            </div>
            <div class="lp-coach-bubble lp-coach-tough">
              No more “tomorrow.” Maya replied four days ago — send it now. 🙂
            </div>
            <div class="lp-coach-actions">
              <span class="lp-coach-pill lp-coach-pill-hype">Hype me up</span>
              <span class="lp-coach-pill">Tough love</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ Closing CTA — giant ghost title parallaxes up from behind the card ═══ -->
    <div ref="ctaWrap" class="lp-cta-wrap">
      <div class="lp-cta-ghost" data-parallax="300" aria-hidden="true">LET’S PLAY</div>
      <section class="lp-cta-band lp-glass">
      <p class="lp-hand lp-cta-hand">go on — your network’s waiting</p>
      <h2 class="lp-cta-title">Networking, but&nbsp;make&nbsp;it a&nbsp;<span class="lp-grad">game</span>.</h2>
      <p class="lp-cta-sub">Start free with 25 Earnest AI tokens on us. Build your card, scan your first contact, and watch the XP roll in.</p>
      <NuxtLink to="/auth/register" class="lp-btn lp-btn-lg lp-btn-game">
        Start your <span class="lp-btn-wm"><span class="lp-wm-a">CARD</span><span class="lp-wm-b">DESK</span></span> game <CdIcon emoji="→" icon="lucide:arrow-right" :size="17" />
      </NuxtLink>
      </section>
    </div>

    <!-- ═══ Footer (shared hue footer carries the Powered-by-Earnest line) ═══ -->
    <CdBrandFooter />
    <div class="lp-footer-pad" />

    <!-- Floating CTA — appears past the hero, hands off to the real CTA at the
         bottom. State (hidden / shown / docked) is set by the scroll handler. -->
    <div class="lp-float-cta" :class="`is-${floatCta}`">
      <NuxtLink to="/auth/register" class="lp-btn lp-btn-lg lp-btn-game">
        Start your <span class="lp-btn-wm"><span class="lp-wm-a">CARD</span><span class="lp-wm-b">DESK</span></span> game <CdIcon emoji="→" icon="lucide:arrow-right" :size="17" />
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.lp {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: 'Proxima Nova', 'Barlow', sans-serif;
  overflow-x: hidden;
}
/* Palette-tinted aurora — same recipe as the app's .cd-root ambient background,
 * so the sell sheet wears the active palette exactly like the logged-in app. */
html[data-theme="glass"][data-mode="dark"] .lp {
  background:
    radial-gradient(125% 80% at 0% 0%, hsl(var(--cd-tint-1-h, 220) var(--cd-tint-1-s, 60%) 32% / 0.4) 0%, transparent 55%),
    radial-gradient(120% 85% at 100% 0%, hsl(var(--cd-tint-3-h, 300) var(--cd-tint-3-s, 60%) 34% / 0.32) 0%, transparent 52%),
    radial-gradient(150% 100% at 50% 100%, hsl(var(--cd-tint-4-h, 160) var(--cd-tint-4-s, 55%) 32% / 0.34) 0%, transparent 60%),
    var(--cd-bg);
  background-attachment: fixed;
}
html[data-theme="glass"][data-mode="light"] .lp {
  background:
    radial-gradient(125% 80% at 0% 0%, hsl(var(--cd-tint-1-h, 220) var(--cd-tint-1-s, 60%) 90% / 0.55) 0%, transparent 55%),
    radial-gradient(120% 85% at 100% 0%, hsl(var(--cd-tint-3-h, 300) var(--cd-tint-3-s, 60%) 90% / 0.45) 0%, transparent 52%),
    radial-gradient(150% 100% at 50% 100%, hsl(var(--cd-tint-4-h, 160) var(--cd-tint-4-s, 55%) 92% / 0.5) 0%, transparent 60%),
    var(--cd-bg);
  background-attachment: fixed;
}

/* ═══ Shared liquid-glass widget surface (full glass-card recipe) ═══ */
.lp-glass {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  box-shadow: var(--glass-shadow, 0 10px 28px -14px rgba(16, 24, 40, 0.08));
}
html[data-theme="glass"][data-mode="dark"] .lp-glass {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h) var(--glass-s) 65% / 0.14) 0%,
      hsl(var(--glass-h) var(--glass-s) 45% / 0.05) 50%,
      hsl(var(--glass-h2) var(--glass-s) 50% / 0.10) 100%),
    rgba(30, 30, 34, 0.52);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid hsl(var(--glass-h) 30% 75% / 0.14);
  box-shadow: var(--glass-inset), var(--glass-shadow);
}
html[data-theme="glass"][data-mode="light"] .lp-glass {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h) var(--glass-s) 60% / 0.10) 0%,
      hsl(var(--glass-h) var(--glass-s) 50% / 0.03) 50%,
      hsl(var(--glass-h2) var(--glass-s) 55% / 0.08) 100%),
    rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid hsl(var(--glass-h) 40% 78% / 0.4);
  box-shadow: var(--glass-inset), var(--glass-shadow);
}

/* ═══ Nav ═══ */
.lp-nav {
  max-width: 1080px;
  margin: 0 auto;
  /* The PWA runs with a black-translucent status bar (see nuxt.config head), so
     the page renders UP under the iPhone notch/status bar. Pad the top by the
     safe-area inset so the "Sign in" / "Get started" row clears it and stays
     tappable — installed to the Home Screen it sat behind the status bar. */
  padding: max(20px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) 20px max(24px, env(safe-area-inset-left, 0px));
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lp-wordmark {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.7rem;
  letter-spacing: 0.08em;
  line-height: 1;
}
.lp-wm-a { color: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(213 64% 52%))); }
.lp-wm-b { color: var(--cd-accent); }
.lp-nav-actions { display: flex; align-items: center; gap: 18px; }
.lp-signin {
  color: var(--cd-muted);
  font-weight: 600;
  font-size: 0.92rem;
  text-decoration: none;
}
.lp-signin:hover { color: var(--cd-text); }

/* ═══ Buttons — liquid-glass chrome ═══ */
.lp-btn {
  --lp-accent: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(208 92% 54%)));
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  color: var(--cd-text);
  font-weight: 800;
  text-decoration: none;
  border-radius: 999px;
  transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  box-shadow: var(--glass-shadow, 0 10px 28px -14px rgba(16, 24, 40, 0.12));
}
html[data-theme="glass"] .lp-btn {
  background: color-mix(in srgb, var(--lp-accent) 16%, var(--cd-chrome-fill, rgba(255, 255, 255, 0.09)));
  backdrop-filter: blur(14px) saturate(1.6);
  -webkit-backdrop-filter: blur(14px) saturate(1.6);
  border: 1px solid color-mix(in srgb, var(--lp-accent) 42%, transparent);
  color: var(--lp-accent);
}
.lp-btn:hover { transform: translateY(-1px); }
html[data-theme="glass"] .lp-btn:hover {
  background: color-mix(in srgb, var(--lp-accent) 26%, var(--cd-chrome-fill-hover, rgba(255, 255, 255, 0.15)));
  border-color: color-mix(in srgb, var(--lp-accent) 58%, transparent);
}
.lp-btn:active { transform: translateY(0); }
.lp-btn-sm { padding: 9px 16px; font-size: 0.86rem; }
.lp-btn-lg {
  padding: 14px 26px;
  font-size: 1.02rem;
  box-shadow: var(--glass-shadow-pop, 0 14px 36px -16px rgba(16, 24, 40, 0.16));
}
.lp-btn-ghost {
  display: inline-flex;
  align-items: center;
  color: var(--cd-text);
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  padding: 14px 6px;
  opacity: 0.85;
}
.lp-btn-ghost:hover { opacity: 1; text-decoration: underline; }

/* "Start your CARDDESK game" — the closing/floating CTA set entirely in the
 * brand display face. Condensed Bebas keeps it on ONE line on small phones
 * (it used to wrap), and the CARDDESK wordmark inside uses the exact header
 * logo treatment (.lp-wm-a chrome / .lp-wm-b green). */
.lp-btn-game {
  font-family: 'Bebas Neue', sans-serif;
  font-weight: 400;
  font-size: 1.35rem;
  letter-spacing: 0.07em;
  line-height: 1;
  white-space: nowrap;
  color: var(--cd-text);
  /* Bebas rides high in its em box — drop the bottom padding a touch so the
   * text sits optically centred in the pill. */
  padding-top: 15px;
  padding-bottom: 13px;
}
html[data-theme="glass"] .lp-btn.lp-btn-game { color: var(--cd-text); }
.lp-btn-wm { display: inline-flex; letter-spacing: 0.08em; }
@media (max-width: 380px) {
  .lp-btn-game { font-size: 1.2rem; padding-left: 20px; padding-right: 20px; }
}

/* ═══ Hero ═══ */
.lp-hero {
  max-width: 1080px;
  margin: 0 auto;
  padding: 36px 24px 64px;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 40px;
  align-items: center;
}
.lp-eyebrow {
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.16em;
  font-size: 0.95rem;
  color: var(--cd-muted);
  text-transform: uppercase;
  margin-bottom: 14px;
}
.lp-h1 {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(3rem, 7vw, 5rem);
  line-height: 0.94;
  font-weight: 400;
  letter-spacing: 0.01em;
  margin: 0 0 18px;
}
.lp-grad {
  background: linear-gradient(100deg, var(--cd-green), var(--cd-palette-primary, #4da6ff) 55%, var(--cd-ice));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.lp-sub {
  font-size: 1.08rem;
  line-height: 1.55;
  color: var(--cd-muted);
  max-width: 30em;
  margin: 0 0 22px;
}
.lp-token-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 0.9rem;
  color: var(--cd-text);
  background: color-mix(in srgb, var(--cd-palette-primary, #4da6ff) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-palette-primary, #4da6ff) 38%, transparent);
  box-shadow: var(--glass-shadow);
  margin-bottom: 22px;
}
html[data-theme="glass"] .lp-token-badge {
  backdrop-filter: blur(14px) saturate(1.6);
  -webkit-backdrop-filter: blur(14px) saturate(1.6);
}
.lp-token-badge strong { color: var(--cd-palette-primary, #4da6ff); }
.lp-cta-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

/* Gaegu handwriting — playful encouragement microcopy ONLY (never titles/data) */
.lp-hand {
  font-family: 'Gaegu', 'Proxima Nova', cursive;
  font-weight: 700;
  font-size: 1.12rem;
  letter-spacing: 0;
  color: color-mix(in srgb, var(--cd-text) 38%, var(--cd-palette-primary, #4da6ff));
  margin: 16px 0 0;
}
.lp-cta-hand {
  color: color-mix(in srgb, var(--cd-text) 38%, var(--cd-palette-primary, #4da6ff));
  margin: 0 0 6px;
  font-size: 1.2rem;
}

/* ═══ Hero art ═══ */
.lp-hero-art { position: relative; display: flex; justify-content: center; align-items: center; min-height: 340px; }
/* The deck tilts as a whole; the cards stack/overlay inside it. */
.lp-deck {
  position: relative;
  z-index: 1;
  width: 300px;
  height: 240px;
  transform: rotate(-5deg);
  perspective: 1200px;
}
/* ── Faint orbit-ring halo behind the deck ── */
.lp-hero-rings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  overflow: visible;
}
.lp-ring {
  fill: none;
  stroke: color-mix(in srgb, var(--cd-palette-primary, #4da6ff) 20%, transparent);
  stroke-width: 1;
}
.lp-ring-dot {
  fill: color-mix(in srgb, var(--cd-palette-primary, #4da6ff) 55%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  /* Each dot's <g> spins around the viewBox origin (the visual centre). */
  .lp-ring-orbit {
    transform-box: view-box;
    transform-origin: 0px 0px;
    animation: lp-ring-spin 30s linear infinite;
  }
  .lp-ring-orbit-1 { animation-duration: 26s; }
  .lp-ring-orbit-2 { animation-duration: 38s; animation-direction: reverse; }
  .lp-ring-orbit-3 { animation-duration: 50s; }
}
@keyframes lp-ring-spin { to { transform: rotate(360deg); } }
.lp-card {
  position: absolute;
  inset: 0;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 20px;
  padding: 22px;
  box-shadow: var(--glass-shadow-pop, 0 40px 90px -30px rgba(0, 0, 0, 0.3));
}
.lp-card-front { z-index: 3; }
/* Blank cards peeking out behind the front one — a deck-of-cards look. */
.lp-card-ghost { z-index: 1; }
.lp-card-ghost-1 { transform: translate(11px, 13px) rotate(3.5deg) scale(0.975); opacity: 0.7; }
.lp-card-ghost-2 { transform: translate(22px, 26px) rotate(7deg) scale(0.95); opacity: 0.45; }
/* Slow flip between sample contacts (out-in: old flips out, new flips in). */
.lp-flip-enter-active { transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease; }
.lp-flip-leave-active { transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease; }
.lp-flip-enter-from { transform: rotateY(30deg) translateZ(-20px); opacity: 0; }
.lp-flip-leave-to { transform: rotateY(-30deg) translateZ(-20px); opacity: 0; }
html[data-theme="glass"][data-mode="dark"] .lp-card {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h) var(--glass-s) 65% / 0.14) 0%,
      hsl(var(--glass-h) var(--glass-s) 45% / 0.05) 50%,
      hsl(var(--glass-h2) var(--glass-s) 50% / 0.10) 100%),
    rgba(30, 30, 34, 0.55);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid hsl(var(--glass-h) 30% 75% / 0.16);
  box-shadow: var(--glass-inset), var(--glass-shadow-pop);
}
html[data-theme="glass"][data-mode="light"] .lp-card {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h) var(--glass-s) 60% / 0.10) 0%,
      hsl(var(--glass-h) var(--glass-s) 50% / 0.03) 50%,
      hsl(var(--glass-h2) var(--glass-s) 55% / 0.08) 100%),
    rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid hsl(var(--glass-h) 40% 78% / 0.4);
  box-shadow: var(--glass-inset), var(--glass-shadow-pop);
}
/* Tint accent strip across the top edge, faded at both ends. */
.lp-card-accent {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  border-radius: 20px 20px 0 0;
  -webkit-mask: linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent);
  mask: linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent);
}
.lp-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.lp-card-id { flex: 1; min-width: 0; }
.lp-card-avatar {
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  font-weight: 800; font-size: 1rem; letter-spacing: 0.02em;
  background: color-mix(in srgb, var(--cd-blue) 18%, transparent);
  color: var(--cd-blue);
}
.lp-card-name { font-weight: 800; font-size: 1.05rem; }
.lp-card-role { font-size: 0.8rem; color: var(--cd-muted); }
/* Level pill — colour is set inline to the active contact's tint. */
.lp-card-level {
  flex-shrink: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.92rem;
  letter-spacing: 0.06em;
  line-height: 1;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.lp-card-rows { display: flex; flex-direction: column; gap: 7px; margin-bottom: 16px; }
.lp-card-line { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--cd-muted); }
/* Footer: QR signature on the left, a live XP meter on the right. */
.lp-card-foot {
  display: flex; align-items: center; gap: 14px;
  padding-top: 14px; border-top: 1px solid var(--cd-bdr);
}
.lp-card-qr { display: flex; flex-shrink: 0; color: var(--cd-text); }
.lp-card-xp { flex: 1; min-width: 0; }
.lp-card-xp-head {
  display: flex; justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--cd-muted);
}
.lp-card-xp-track {
  height: 6px; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--cd-text) 10%, transparent);
}
.lp-card-xp-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
.lp-chip {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.82rem;
  font-weight: 800;
  padding: 7px 12px;
  border-radius: 999px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  box-shadow: var(--glass-shadow);
  animation: lp-float 4s ease-in-out infinite;
}
html[data-theme="glass"] .lp-chip {
  background: var(--cd-chrome-fill, rgba(255, 255, 255, 0.09));
  backdrop-filter: blur(14px) saturate(1.6);
  -webkit-backdrop-filter: blur(14px) saturate(1.6);
  border: 1px solid hsl(var(--glass-h) 40% 78% / 0.28);
  box-shadow: var(--glass-shadow-pop);
}
/* Chips frame the card's outer edges rather than covering its (now denser)
 * content — XP off the top-right, streak + Orbit floating below the card. */
.lp-chip-xp { top: 4px; right: 14px; color: var(--cd-green); animation-delay: 0s; }
.lp-chip-streak { bottom: 2px; left: 24px; color: var(--cd-orange); animation-delay: 0.8s; }
.lp-chip-orbit { bottom: -8px; right: 24px; color: var(--cd-blue); animation-delay: 1.6s; }
@keyframes lp-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

/* ═══ Sections ═══ */
/* Vertical rhythm scales with the viewport (clamp) so each section has room to
 * breathe and the keyword watermarks have empty space to parallax through —
 * generous on desktop, still ample but tighter on phones. */
.lp-section { max-width: 1080px; margin: 0 auto; padding: clamp(88px, 13vw, 168px) 24px; }
.lp-section-head { text-align: center; margin-bottom: clamp(56px, 10vw, 112px); }
.lp-h2 {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.9rem, 4vw, 2.9rem);
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1.04;
  margin: 6px auto 0;
  max-width: 16em;
}
/* Script variant — turns the "why it's different" line into a handwritten
 * statement, like a testimonial pulled-quote rather than a display header. */
.lp-h2-script {
  font-family: 'Gaegu', 'Proxima Nova', cursive;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
  font-size: clamp(2.1rem, 4.6vw, 3.3rem);
  line-height: 1.18;
  max-width: 14em;
  color: color-mix(in srgb, var(--cd-text) 72%, var(--cd-palette-primary, #4da6ff));
}
/* Section eyebrow promoted to a giant faint watermark sitting behind the script
 * statement — the quote reads as the foreground, the label as the backdrop. */
.lp-section-head--quote { position: relative; }
.lp-head-ghost {
  position: absolute;
  left: 50%;
  top: 46%;
  /* X stays centred; Y carries the parallax shift (see the rAF handler). */
  transform: translate(-50%, calc(-50% + var(--lp-shift, 0px)));
  will-change: transform;
  z-index: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2rem, 8vw, 5.6rem);
  letter-spacing: 0.05em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  color: color-mix(in srgb, var(--cd-text) 9%, transparent);
  pointer-events: none;
  user-select: none;
}
.lp-section-head--quote .lp-h2-script { position: relative; z-index: 1; }

/* ═══ Featured callout rhythm (Gamify · AI · Orbit · Compete) ═══ */
.lp-callout {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 60px;
  align-items: center;
  margin-top: clamp(140px, 20vw, 248px);
}
/* First callout sits closer to the section head (which already has its own
 * margin-bottom). Targeted via the adjacent head — `.lp-callout:first-of-type`
 * never matches here because the section head is the first div of its type. */
.lp-section-head + .lp-callout { margin-top: clamp(48px, 7vw, 88px); }
/* Copy + visual ride above the keyword watermark. */
.lp-callout-copy,
.lp-callout-art { position: relative; z-index: 1; }

/* ── Section keyword watermark — giant faint word that parallaxes behind the
 *    callout. Biased toward the visual side so it stays clear of the body copy
 *    (and the glass visual frosts the part that sits behind it). ── */
.lp-ghost {
  position: absolute;
  top: 40%;
  left: 0;
  z-index: 0;
  transform: translateY(calc(-50% + var(--lp-shift, 0px)));
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2.6rem, 12vw, 9.5rem);
  line-height: 0.82;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  color: color-mix(in srgb, var(--cd-text) 10%, transparent);
  pointer-events: none;
  user-select: none;
  will-change: transform;
}
/* Anchor each watermark to its copy block's outer edge — left-aligned on the
 * left rows, right-aligned on the right rows — so it reads as oversized type
 * set flush to the text it sits behind, alternating side per row. */
.lp-callout-rev .lp-ghost { left: auto; right: 0; }
/* Reversed rows place the visual on the left for an alternating zig-zag. */
.lp-callout-rev .lp-callout-art { order: -1; }
/* Orbit's live showcase wants a touch more room than its copy. */
.lp-callout--orbit { grid-template-columns: 0.86fr 1.14fr; }
.lp-callout-copy .lp-eyebrow { margin-bottom: 10px; }
.lp-callout-h {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.7rem, 3.2vw, 2.5rem);
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1.05;
  margin: 0;
  max-width: 12em;
}
.lp-callout-body {
  font-size: 1.02rem;
  line-height: 1.6;
  color: var(--cd-muted);
  margin: 14px 0 0;
  max-width: 33em;
}
.lp-callout-cta { margin-top: 18px; }
.lp-callout-art { display: flex; justify-content: center; min-width: 0; }

/* ── Gamify visual — confetti + XP pop + level bar + reward chips ── */
.lp-gamify {
  position: relative;
  width: 100%;
  max-width: 380px;
  border-radius: 22px;
  padding: 30px 26px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  overflow: hidden;
}
.lp-confetti { position: absolute; top: 0; left: 0; width: 100%; height: 80px; pointer-events: none; }
.lp-gamify-xp {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 3.4rem;
  line-height: 1;
  letter-spacing: 0.01em;
  color: var(--cd-green);
  margin-top: 16px;
}
.lp-gamify-bar { width: 100%; max-width: 240px; }
.lp-gamify-bar-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--cd-muted);
  margin-bottom: 6px;
}
.lp-gamify-track {
  height: 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cd-text) 8%, transparent);
  overflow: hidden;
}
.lp-gamify-fill {
  height: 100%;
  width: 82%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--cd-green), var(--cd-palette-primary, #4da6ff));
}
.lp-gamify-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.lp-gchip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
}
html[data-theme="glass"] .lp-gchip {
  background: var(--cd-chrome-fill, rgba(255, 255, 255, 0.09));
  backdrop-filter: blur(14px) saturate(1.6);
  -webkit-backdrop-filter: blur(14px) saturate(1.6);
  border: 1px solid hsl(var(--glass-h) 40% 78% / 0.28);
}
.lp-gchip-streak { color: var(--cd-orange); }
.lp-gchip-shield { color: var(--cd-gold); }
.lp-gchip-orbit { color: var(--cd-blue); }
/* Motion: confetti drifts down + XP gives a little pop. Held still for
 * reduced-motion users — the layout reads fine static. */
@media (prefers-reduced-motion: no-preference) {
  .lp-cf { animation: lp-cf-fall 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  .lp-cf:nth-child(2n) { animation-duration: 3.8s; }
  .lp-cf:nth-child(3n) { animation-duration: 2.6s; }
  .lp-cf:nth-child(1) { animation-delay: 0s; }
  .lp-cf:nth-child(2) { animation-delay: 0.3s; }
  .lp-cf:nth-child(3) { animation-delay: 0.6s; }
  .lp-cf:nth-child(4) { animation-delay: 0.15s; }
  .lp-cf:nth-child(5) { animation-delay: 0.5s; }
  .lp-cf:nth-child(6) { animation-delay: 0.8s; }
  .lp-cf:nth-child(7) { animation-delay: 0.35s; }
  .lp-cf:nth-child(8) { animation-delay: 0.65s; }
  .lp-cf:nth-child(9) { animation-delay: 0.9s; }
  .lp-gamify-xp { animation: lp-xp-pop 3.2s ease-in-out infinite; }
}
@keyframes lp-cf-fall {
  0% { transform: translateY(-8px) rotate(0deg); opacity: 0; }
  18% { opacity: 1; }
  100% { transform: translateY(48px) rotate(190deg); opacity: 0; }
}
@keyframes lp-xp-pop {
  0%, 72%, 100% { transform: scale(1); }
  8% { transform: scale(1.12); }
}

/* ── Earnest AI visual — context chips + a drafted follow-up ── */
.lp-ai {
  width: 100%;
  max-width: 400px;
  border-radius: 22px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lp-ai-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.lp-ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 800;
  font-size: 0.92rem;
  color: var(--cd-palette-primary, #4da6ff);
}
.lp-ai-reading {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cd-dim);
}
.lp-ai-context { display: flex; flex-wrap: wrap; gap: 7px; }
.lp-ai-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--cd-muted);
  padding: 5px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cd-text) 5%, transparent);
  border: 1px solid var(--cd-bdr);
}
.lp-ai-draft {
  border-radius: 14px;
  padding: 13px 15px;
  background: color-mix(in srgb, var(--cd-palette-primary, #4da6ff) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-palette-primary, #4da6ff) 28%, transparent);
}
.lp-ai-draft-label {
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--cd-palette-primary, #4da6ff);
  margin-bottom: 6px;
}
.lp-ai-draft-body { font-size: 0.92rem; line-height: 1.5; color: var(--cd-text); margin: 0; }

/* ── Daily-games visual (Play callout) — a Network IQ round mid-answer ── */
.lp-quiz {
  width: 100%;
  max-width: 380px;
  border-radius: 22px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lp-quiz-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.lp-quiz-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-weight: 800; font-size: 0.92rem; color: var(--cd-purple, #b87dff);
}
.lp-quiz-tag {
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--cd-muted);
  background: color-mix(in srgb, var(--cd-muted) 14%, transparent);
  padding: 3px 9px; border-radius: 999px;
}
.lp-quiz-dots { display: flex; align-items: center; gap: 5px; }
.lp-quiz-dots span { width: 7px; height: 7px; border-radius: 50%; background: color-mix(in srgb, var(--cd-text) 14%, transparent); }
.lp-quiz-dots .hit { background: var(--cd-green); }
.lp-quiz-dots .cur { background: var(--cd-purple, #b87dff); transform: scale(1.25); }
.lp-quiz-q { font-weight: 800; font-size: 1.02rem; margin: 2px 0; }
.lp-quiz-opt {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 13px; border-radius: 12px;
  font-size: 0.9rem; font-weight: 700; color: var(--cd-muted);
  background: color-mix(in srgb, var(--cd-text) 5%, transparent);
  border: 1px solid var(--cd-bdr);
}
.lp-quiz-correct {
  color: var(--cd-green);
  background: color-mix(in srgb, var(--cd-green) 12%, transparent);
  border-color: color-mix(in srgb, var(--cd-green) 42%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  .lp-quiz-correct { animation: lp-quiz-land 3.4s ease-in-out infinite; }
}
@keyframes lp-quiz-land {
  0%, 86%, 100% { transform: scale(1); }
  92% { transform: scale(1.03); }
}
.lp-quiz-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 10px; border-top: 1px solid var(--cd-bdr);
}
.lp-quiz-xp {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.3rem; line-height: 1; color: var(--cd-green);
}
.lp-quiz-roulette {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.78rem; font-weight: 800; color: var(--cd-gold);
}

/* ── Event Mode visual (Event callout) — live pill + climbing count ── */
.lp-event {
  width: 100%;
  max-width: 360px;
  border-radius: 22px;
  padding: 20px 20px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.lp-event-pill {
  display: inline-flex; align-items: center; gap: 8px;
  width: 100%;
  font-size: 0.84rem; font-weight: 700; color: var(--cd-text);
  padding: 8px 13px; border-radius: 999px;
  background: color-mix(in srgb, var(--cd-green) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-green) 30%, transparent);
  margin-bottom: 8px;
}
.lp-event-live {
  width: 8px; height: 8px; flex-shrink: 0; border-radius: 50%;
  background: var(--cd-green);
  box-shadow: 0 0 8px color-mix(in srgb, var(--cd-green) 70%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  .lp-event-live { animation: lp-ep-pulse 1.6s ease-in-out infinite; }
}
@keyframes lp-ep-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}
.lp-event-met { margin-left: auto; font-size: 0.78rem; color: var(--cd-green); }
.lp-event-num {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 4.4rem; line-height: 0.95; color: var(--cd-green);
}
.lp-event-unit { font-size: 0.9rem; font-weight: 700; color: var(--cd-text); }
.lp-event-scan {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  margin-top: 14px; padding: 12px 14px; border-radius: 14px;
  color: var(--cd-text);
  background: color-mix(in srgb, var(--cd-text) 5%, transparent);
  border: 1px solid var(--cd-bdr);
}
.lp-event-scan-t { font-weight: 800; font-size: 0.92rem; }
.lp-event-scan-s { margin-left: auto; font-size: 0.76rem; color: var(--cd-muted); }

/* ── Digital-card visual (Card callout) — a shareable contact card + QR ── */
.lp-cardviz {
  width: 100%;
  max-width: 360px;
  border-radius: 22px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.lp-cardviz-top { display: flex; align-items: center; gap: 12px; }
.lp-cardviz-avatar {
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--cd-orange) 18%, transparent);
  color: var(--cd-orange);
}
.lp-cardviz-name { font-weight: 800; font-size: 1.05rem; }
.lp-cardviz-role { font-size: 0.8rem; color: var(--cd-muted); }
.lp-cardviz-rows { display: flex; flex-direction: column; gap: 7px; }
.lp-cardviz-line { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--cd-muted); }
.lp-cardviz-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 14px; border-top: 1px solid var(--cd-bdr);
}
.lp-cardviz-qr { color: var(--cd-text); display: flex; }
.lp-cardviz-tap {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.8rem; font-weight: 800; color: var(--cd-orange);
  padding: 7px 13px; border-radius: 999px;
  background: color-mix(in srgb, var(--cd-orange) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-orange) 32%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  .lp-cardviz-tap { animation: lp-tap-pulse 2.6s ease-in-out infinite; }
}
@keyframes lp-tap-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cd-orange) 32%, transparent); }
  50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--cd-orange) 0%, transparent); }
}

/* ── Coaching-session visual (Coaching callout) — chat bubbles + tone pills ── */
.lp-coach {
  width: 100%;
  max-width: 400px;
  border-radius: 22px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lp-coach-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.lp-coach-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-weight: 800; font-size: 0.9rem; color: var(--cd-ice);
}
.lp-coach-tag {
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--cd-muted);
  background: color-mix(in srgb, var(--cd-muted) 14%, transparent);
  padding: 3px 9px; border-radius: 999px;
}
.lp-coach-bubble {
  font-size: 0.92rem; line-height: 1.5; color: var(--cd-text);
  padding: 11px 14px; border-radius: 14px; border-top-left-radius: 5px;
  background: color-mix(in srgb, var(--cd-ice) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-ice) 26%, transparent);
}
.lp-coach-tough {
  background: color-mix(in srgb, var(--cd-orange) 11%, transparent);
  border-color: color-mix(in srgb, var(--cd-orange) 26%, transparent);
}
.lp-coach-actions { display: flex; gap: 8px; margin-top: 2px; }
.lp-coach-pill {
  font-size: 0.8rem; font-weight: 800; color: var(--cd-muted);
  padding: 7px 13px; border-radius: 999px;
  background: color-mix(in srgb, var(--cd-text) 5%, transparent);
  border: 1px solid var(--cd-bdr);
}
.lp-coach-pill-hype { color: var(--cd-ice); border-color: color-mix(in srgb, var(--cd-ice) 38%, transparent); }

/* ═══ Compete leaderboard card (used inside the Compete callout) ═══ */
.lp-board { width: 100%; max-width: 420px; border-radius: 22px; padding: 18px 18px 14px; }
.lp-board-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 8px 12px;
}
.lp-board-title { display: inline-flex; align-items: center; gap: 7px; font-weight: 800; font-size: 0.95rem; }
.lp-board-tag {
  font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--cd-dim); font-weight: 700;
}
.lp-board-rows { display: flex; flex-direction: column; gap: 6px; }
.lp-row {
  display: grid;
  grid-template-columns: 24px 34px 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 13px;
  background: color-mix(in srgb, var(--cd-text) 4%, transparent);
  transition: transform 0.18s ease;
}
.lp-row-you {
  background: color-mix(in srgb, var(--cd-green) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-green) 40%, transparent);
  box-shadow: var(--glass-shadow);
  transform: scale(1.015);
}
.lp-rank {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.15rem; line-height: 1;
  color: var(--cd-dim); text-align: center;
}
.lp-rank-1 { color: var(--cd-gold); }
.lp-rank-2 { color: var(--cd-ice); }
.lp-rank-3 { color: var(--cd-orange); }
.lp-ava {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.9rem;
}
.lp-row-name { font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }
.lp-you-tag {
  font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--cd-green);
  background: color-mix(in srgb, var(--cd-green) 16%, transparent);
  padding: 2px 7px; border-radius: 999px;
}
.lp-row-streak {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.82rem; font-weight: 700; color: var(--cd-orange);
}
.lp-row-xp {
  font-weight: 800; font-size: 0.95rem;
  font-variant-numeric: tabular-nums; min-width: 54px; text-align: right;
}

/* ═══ Closing CTA (with parallax ghost title behind it) ═══ */
/* The wrap clips the giant title so it reads as rising up from behind the card;
 * the title's own travel is driven by --lp-shift (the shared parallax handler,
 * keyed off this wrap as its host). */
.lp-cta-wrap {
  position: relative;
  overflow: hidden;
  /* Extra runway above so the "LET'S PLAY" watermark has room to rise, and a tall
   * gap below so the closing card isn't crowded by the footer. The 160px floor
   * keeps a real runway on phones — at 104px the risen title never cleared the
   * (much taller) stacked band. */
  padding-top: clamp(160px, 17vw, 210px);
  margin-bottom: clamp(112px, 15vw, 190px);
}
.lp-cta-ghost {
  position: absolute;
  left: 50%;
  /* Anchored relative to the wrap's top RUNWAY (the padding-top clamp below),
   * not a % of the wrap — on phones the stacked band is far taller than on
   * desktop, so a percentage anchor left the risen title trapped behind the
   * card. Resting just under the runway's midpoint means the title is already
   * visible above the band when it's centred in the viewport (parallax shift
   * ≈ 0), and the remaining travel won't clip it at the top on a full scroll. */
  top: calc(clamp(160px, 17vw, 210px) / 2 + 30px);
  z-index: 0;
  transform: translate(-50%, calc(-50% + var(--lp-shift, 0px)));
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(3.5rem, 15vw, 12rem);
  line-height: 0.84;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  color: color-mix(in srgb, var(--cd-text) 13%, transparent);
  pointer-events: none;
  user-select: none;
  will-change: transform;
}
.lp-cta-band {
  position: relative;
  z-index: 1;
  width: calc(100% - 48px);
  max-width: 1032px;
  margin: 0 auto;
  padding: 64px 32px 68px;
  text-align: center;
  border-radius: 26px;
}
.lp-cta-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2.1rem, 4.5vw, 3.1rem);
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1.04;
  margin: 0 0 12px;
}
.lp-cta-sub { font-size: 1.05rem; color: var(--cd-muted); margin: 0 0 26px; }

/* ═══ Footer ═══ */
.lp-footer {
  max-width: 1080px;
  margin: 0 auto;
  padding: 28px 24px 48px;
  border-top: 1px solid var(--cd-bdr);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.lp-wordmark-sm { font-size: 1.25rem; }
.lp-footer-meta { font-size: 0.86rem; color: var(--cd-muted); }
.lp-footer-meta strong { color: var(--cd-text); }
.lp-foot-link { color: var(--cd-muted); text-decoration: none; }
.lp-foot-link:hover { color: var(--cd-text); text-decoration: underline; }
.lp-footer-pad { height: 28px; }

/* ═══ Floating CTA — fixed pill that fades in past the hero and hands off to
 *    the real CTA button as the bottom card scrolls into view. ═══ */
.lp-float-cta {
  position: fixed;
  left: 50%;
  bottom: 26px;
  z-index: 50;
  transform: translateX(-50%) translateY(26px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.45s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.lp-float-cta.is-shown {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}
/* Docking: shrink + settle so it reads as merging into the real CTA button that
 * is now arriving from the bottom. */
.lp-float-cta.is-docked {
  opacity: 0;
  transform: translateX(-50%) translateY(14px) scale(0.9);
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .lp-float-cta { transition: opacity 0.3s ease; transform: translateX(-50%); }
  .lp-float-cta.is-shown { transform: translateX(-50%); }
  .lp-float-cta.is-docked { transform: translateX(-50%); }
}

/* ═══ Responsive ═══ */
@media (max-width: 860px) {
  .lp-hero { grid-template-columns: 1fr; gap: 8px; padding-bottom: 40px; }
  .lp-hero-art { order: -1; min-height: 280px; margin-bottom: 8px; }
  /* Tighter side gutters on phones; vertical rhythm stays driven by the fluid
   * clamp() values on the base rules so the parallax keeps its breathing room. */
  .lp-section { padding-left: 20px; padding-right: 20px; }
  /* Callouts stack; copy always leads, visual follows (drop the zig-zag). */
  .lp-callout,
  .lp-callout--orbit { grid-template-columns: 1fr; gap: 32px; }
  .lp-callout-rev .lp-callout-art { order: 0; }
  /* Single stacked column — both align flush-left with the copy. */
  .lp-ghost,
  .lp-callout-rev .lp-ghost { left: 0; right: auto; }
}
@media (max-width: 480px) {
  .lp-cta-row { flex-direction: column; align-items: stretch; }
  .lp-btn-lg { justify-content: center; }
  .lp-btn-ghost { justify-content: center; padding: 8px; }
}
</style>
