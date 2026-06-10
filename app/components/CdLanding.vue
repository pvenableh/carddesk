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
const pillars = [
  {
    icon: 'lucide:gamepad-2',
    emoji: '🎮',
    color: 'var(--cd-green)',
    title: 'Networking, gamified',
    body: 'Earn XP for every card you scan and contact you save. Level up, keep your streak alive, and watch the confetti fly. Follow-ups become a game you actually want to win.',
  },
  {
    icon: 'lucide:trophy',
    emoji: '🏆',
    color: 'var(--cd-gold)',
    title: 'Compete with your circle',
    body: 'Networking’s better with rivals. Connect with friends and colleagues, then climb your network’s leaderboard — compare XP, streaks, and who’s really working the room.',
  },
  {
    icon: 'lucide:sparkles',
    emoji: '🧠',
    color: 'var(--cd-palette-primary, #4da6ff)',
    title: 'Earnest AI in your corner',
    body: 'Earnest AI reads both sides of a card, drafts your follow-ups, surfaces conversation starters, and spots the connections worth nurturing — so you always know your next move.',
  },
  {
    icon: 'lucide:messages-square',
    emoji: '💬',
    color: 'var(--cd-ice)',
    title: 'Coaching sessions with Earnest AI',
    body: 'Low on momentum? Run a session with Earnest AI for fresh outreach ideas and a hit of motivation — hype yourself up or take a tough-love nudge to actually follow through.',
  },
  {
    icon: 'lucide:orbit',
    emoji: '🪐',
    color: 'var(--cd-palette-primary, #4da6ff)',
    title: 'Your own Orbit',
    body: 'Everyone you meet pulls into your personal Orbit — a living map of your network. See who’s close, who’s drifting, and who deserves a check-in.',
  },
  {
    icon: 'lucide:id-card',
    emoji: '🎴',
    color: 'var(--cd-orange)',
    title: 'A card that’s all you',
    body: 'Build a personalized digital business card and share it with a tap or a QR scan. No app required on their end — just a link that makes you look sharp.',
  },
]

const steps = [
  { n: '1', emoji: '📷', icon: 'lucide:scan-line', title: 'Scan a card', body: 'Snap a business card — front and back.' },
  { n: '2', emoji: '✨', icon: 'lucide:wand-sparkles', title: 'Earnest AI fills it in', body: 'Name, company, details — extracted instantly. +50 XP.' },
  { n: '3', emoji: '🪐', icon: 'lucide:orbit', title: 'Your Orbit grows', body: 'They join your network. Earnest AI tees up the follow-up.' },
]

// Sample friends leaderboard for the "compete with friends" spotlight. You sit
// at #2, 160 XP behind Maya — close enough to feel the chase (the handwriting
// microcopy references that exact gap).
const leaderboard = [
  { rank: 1, name: 'Maya C.', xp: 2640, streak: 9, tint: 'var(--cd-gold)' },
  { rank: 2, name: 'You', xp: 2480, streak: 12, tint: 'var(--cd-green)', you: true },
  { rank: 3, name: 'Devin B.', xp: 2210, streak: 5, tint: 'var(--cd-ice)' },
  { rank: 4, name: 'Priya N.', xp: 1990, streak: 7, tint: 'var(--cd-palette-primary, #4da6ff)' },
  { rank: 5, name: 'Alex R.', xp: 1640, streak: 3, tint: 'var(--cd-orange)' },
]

// Hero deck — a small stack of cards that slowly flips through sample contacts.
const heroCards = [
  { name: 'Alex Rivera', role: 'Founder · Northwind', email: 'alex@northwind.co', phone: '(415) 555-0199', tint: 'var(--cd-palette-primary, #4da6ff)' },
  { name: 'Maya Chen', role: 'Product Lead · Lumen', email: 'maya@lumen.io', phone: '(212) 555-0148', tint: 'var(--cd-green)' },
  { name: 'Devin Brooks', role: 'Designer · Foundry', email: 'devin@foundry.studio', phone: '(646) 555-0173', tint: 'var(--cd-gold)' },
  { name: 'Priya Nair', role: 'VP Sales · Beacon', email: 'priya@beacon.co', phone: '(312) 555-0186', tint: 'var(--cd-orange)' },
]
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
    <section class="lp-hero">
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
          <NuxtLink to="/auth/register" class="lp-btn lp-btn-lg">
            Start free <CdIcon emoji="→" icon="lucide:arrow-right" :size="17" />
          </NuxtLink>
          <NuxtLink to="/login" class="lp-btn-ghost">I already have an account</NuxtLink>
        </div>
        <p class="lp-hand">no credit card — your first 25 tokens are on us ✨</p>
      </div>

      <!-- Hero visual: a slow flip-through deck of cards + floating chips -->
      <div class="lp-hero-art" aria-hidden="true">
        <div class="lp-deck">
          <!-- static cards peeking out behind, for depth -->
          <div class="lp-card lp-card-ghost lp-card-ghost-2" />
          <div class="lp-card lp-card-ghost lp-card-ghost-1" />
          <!-- front card slowly flips through sample contacts -->
          <Transition name="lp-flip" mode="out-in">
            <div :key="activeHero" class="lp-card lp-card-front">
              <div class="lp-card-top">
                <div
                  class="lp-card-avatar"
                  :style="{ background: `color-mix(in srgb, ${heroCards[activeHero].tint} 18%, transparent)`, color: heroCards[activeHero].tint }"
                >
                  <CdIcon emoji="🙂" icon="lucide:user-round" :size="26" />
                </div>
                <div>
                  <div class="lp-card-name">{{ heroCards[activeHero].name }}</div>
                  <div class="lp-card-role">{{ heroCards[activeHero].role }}</div>
                </div>
              </div>
              <div class="lp-card-rows">
                <div class="lp-card-line"><CdIcon emoji="✉️" icon="lucide:mail" :size="13" /> {{ heroCards[activeHero].email }}</div>
                <div class="lp-card-line"><CdIcon emoji="📞" icon="lucide:phone" :size="13" /> {{ heroCards[activeHero].phone }}</div>
              </div>
              <div class="lp-card-qr"><CdIcon emoji="🔳" icon="lucide:qr-code" :size="40" /></div>
            </div>
          </Transition>
        </div>

        <div class="lp-chip lp-chip-xp">+50 XP</div>
        <div class="lp-chip lp-chip-streak"><CdIcon emoji="🔥" icon="lucide:flame" :size="13" /> 7-day streak</div>
        <div class="lp-chip lp-chip-orbit"><CdIcon emoji="🪐" icon="lucide:orbit" :size="13" /> +1 to Orbit</div>
      </div>
    </section>

    <!-- ═══ Pillars ═══ -->
    <section class="lp-section">
      <div class="lp-section-head">
        <div class="lp-eyebrow">Why it’s different</div>
        <h2 class="lp-h2">Everything about meeting people, made fun</h2>
      </div>
      <div class="lp-grid">
        <article v-for="p in pillars" :key="p.title" class="lp-feature lp-glass">
          <div class="lp-feature-icon" :style="{ color: p.color }">
            <CdIcon :emoji="p.emoji" :icon="p.icon" :size="24" />
          </div>
          <h3 class="lp-feature-title">{{ p.title }}</h3>
          <p class="lp-feature-body">{{ p.body }}</p>
        </article>
      </div>
    </section>

    <!-- ═══ Compete with friends ═══ -->
    <section class="lp-section lp-versus">
      <div class="lp-versus-copy">
        <div class="lp-eyebrow">The fun part</div>
        <h2 class="lp-h2 lp-versus-h2">Climb the board. Earn the <span class="lp-grad">bragging rights</span>.</h2>
        <p class="lp-versus-body">
          Add the friends and colleagues you actually network with and you’ll all share a
          leaderboard. Watch the XP race update in real time, defend your streak, and let a
          little healthy rivalry push everyone to keep in touch. Nothing makes you send the
          follow-up quite like watching a friend pass you.
        </p>
        <p class="lp-hand">Maya’s only 160 XP ahead 👀</p>
        <div class="lp-cta-row lp-versus-cta">
          <NuxtLink to="/auth/register" class="lp-btn lp-btn-lg">
            Start climbing <CdIcon emoji="→" icon="lucide:arrow-right" :size="17" />
          </NuxtLink>
        </div>
      </div>

      <div class="lp-board lp-glass" aria-hidden="true">
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
    </section>

    <!-- ═══ How it works ═══ -->
    <section class="lp-section">
      <div class="lp-section-head">
        <div class="lp-eyebrow">How it works</div>
        <h2 class="lp-h2">From pocket clutter to power network in three taps</h2>
      </div>
      <div class="lp-steps">
        <div v-for="s in steps" :key="s.n" class="lp-step lp-glass">
          <div class="lp-step-num">{{ s.n }}</div>
          <div class="lp-step-icon"><CdIcon :emoji="s.emoji" :icon="s.icon" :size="22" /></div>
          <h3 class="lp-step-title">{{ s.title }}</h3>
          <p class="lp-step-body">{{ s.body }}</p>
        </div>
      </div>
    </section>

    <!-- ═══ Closing CTA ═══ -->
    <section class="lp-cta-band lp-glass">
      <p class="lp-hand lp-cta-hand">go on — your network’s waiting</p>
      <h2 class="lp-cta-title">Start free — <span class="lp-grad">25 Earnest AI tokens</span> on us</h2>
      <p class="lp-cta-sub">Build your card, scan your first contact, and watch the XP roll in.</p>
      <NuxtLink to="/auth/register" class="lp-btn lp-btn-lg">
        Create your CardDesk <CdIcon emoji="→" icon="lucide:arrow-right" :size="17" />
      </NuxtLink>
    </section>

    <!-- ═══ Footer (shared hue footer carries the Powered-by-Earnest line) ═══ -->
    <CdBrandFooter />
    <div class="lp-footer-pad" />
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
  padding: 20px 24px;
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
  width: 300px;
  height: 240px;
  transform: rotate(-5deg);
  perspective: 1200px;
}
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
.lp-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.lp-card-avatar {
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--cd-blue) 18%, transparent);
  color: var(--cd-blue);
}
.lp-card-name { font-weight: 800; font-size: 1.05rem; }
.lp-card-role { font-size: 0.8rem; color: var(--cd-muted); }
.lp-card-rows { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
.lp-card-line { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--cd-muted); }
.lp-card-qr {
  display: flex; justify-content: center; padding-top: 14px;
  border-top: 1px solid var(--cd-bdr); color: var(--cd-text);
}
.lp-chip {
  position: absolute;
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
.lp-chip-xp { top: 8px; right: 18px; color: var(--cd-green); animation-delay: 0s; }
.lp-chip-streak { bottom: 60px; left: 0; color: var(--cd-orange); animation-delay: 0.8s; }
.lp-chip-orbit { bottom: 6px; right: 30px; color: var(--cd-blue); animation-delay: 1.6s; }
@keyframes lp-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

/* ═══ Sections ═══ */
.lp-section { max-width: 1080px; margin: 0 auto; padding: 56px 24px; }
.lp-section-head { text-align: center; margin-bottom: 40px; }
.lp-h2 {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.9rem, 4vw, 2.9rem);
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1.04;
  margin: 6px auto 0;
  max-width: 16em;
}

/* Pillars grid */
.lp-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}
.lp-feature {
  border-radius: 18px;
  padding: 26px;
  transition: transform 0.18s ease;
}
.lp-feature:hover { transform: translateY(-3px); }
.lp-feature-icon {
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, currentColor 14%, transparent);
  margin-bottom: 16px;
}
.lp-feature-title { font-size: 1.18rem; font-weight: 800; margin: 0 0 8px; }
.lp-feature-body { font-size: 0.95rem; line-height: 1.55; color: var(--cd-muted); margin: 0; }

/* Steps */
.lp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.lp-step {
  position: relative;
  text-align: center;
  padding: 30px 22px;
  border-radius: 18px;
}
.lp-step-num {
  position: absolute; top: 14px; right: 16px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.5rem; color: var(--cd-dim); line-height: 1;
}
.lp-step-icon {
  width: 52px; height: 52px; margin: 0 auto 14px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--cd-accent) 14%, transparent);
  color: var(--cd-accent);
}
.lp-step-title { font-size: 1.1rem; font-weight: 800; margin: 0 0 6px; }
.lp-step-body { font-size: 0.92rem; line-height: 1.5; color: var(--cd-muted); margin: 0; }

/* ═══ Compete with friends ═══ */
.lp-versus {
  display: grid;
  grid-template-columns: 0.92fr 1.08fr;
  gap: 48px;
  align-items: center;
}
.lp-versus-h2 { text-align: left; margin: 6px 0 0; max-width: 12em; }
.lp-versus-body { font-size: 1.02rem; line-height: 1.6; color: var(--cd-muted); margin: 16px 0 0; max-width: 32em; }
.lp-versus-cta { margin-top: 18px; }

.lp-board { border-radius: 22px; padding: 18px 18px 14px; }
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

/* ═══ Closing CTA ═══ */
.lp-cta-band {
  width: calc(100% - 48px);
  max-width: 1032px;
  margin: 20px auto 48px;
  padding: 48px 32px 52px;
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

/* ═══ Responsive ═══ */
@media (max-width: 860px) {
  .lp-hero { grid-template-columns: 1fr; gap: 8px; padding-bottom: 40px; }
  .lp-hero-art { order: -1; min-height: 280px; margin-bottom: 8px; }
  .lp-grid { grid-template-columns: 1fr; }
  .lp-steps { grid-template-columns: 1fr; }
  .lp-versus { grid-template-columns: 1fr; gap: 28px; }
}
@media (max-width: 480px) {
  .lp-cta-row { flex-direction: column; align-items: stretch; }
  .lp-btn-lg { justify-content: center; }
  .lp-btn-ghost { justify-content: center; padding: 8px; }
}
</style>
