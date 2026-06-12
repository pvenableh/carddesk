<script setup lang="ts">
/**
 * Public help center — FAQ + quick tutorials. Reachable logged-out (linked from
 * the shared brand footer) so prospects and users alike can self-serve. No auth
 * middleware; uses the same liquid-glass surfaces as the rest of the app.
 */
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Help & FAQ · CardDesk',
  description: 'CardDesk help center — quick tutorials on scanning cards, Event Mode, sharing your digital card, and answers to common questions.',
})

const { loggedIn } = useUserSession()
const { show: openFeedback } = useFeedbackSheet()

const tutorials = [
  {
    icon: 'lucide:scan-line',
    title: 'Scan a business card',
    body: 'Tap Add Contact, then Scan Business Card. Snap the front, flip for the back (or Skip if single-sided), and Earnest AI fills in the name, title, company, email, phone and socials. Review, then Save — they land in your network with +75 XP.',
  },
  {
    icon: 'lucide:radio',
    title: 'Run Event Mode',
    body: 'Heading to a conference or meetup? Open Event Mode from the Vibe screen and name the event. Every card you scan is auto-tagged to it, your live count climbs, and when you wrap, the session is saved to your event history so you can revisit who you met.',
  },
  {
    icon: 'lucide:contact',
    title: 'Share your digital card',
    body: 'Edit your CardDesk card under Account → Your CardDesk Card. Add a photo, title, company and links. Share the link or let people scan your QR code — it drops a native “Add Contact” prompt on their phone, no app needed.',
  },
  {
    icon: 'lucide:trending-up',
    title: 'Graduate contacts to clients & partners',
    body: 'Every contact climbs a simple ladder: New → Warming (automatic when you reach out) → Opportunity, where you set the goal — a client who hires you, or a partner you trade work with. Closed it? Graduate them and pick up the project or contract in Earnest. Earnest AI suggests the next move along the way.',
  },
]

const faqs = [
  {
    q: 'How does card scanning work?',
    a: 'You take a photo of the card and Earnest AI reads the text, extracting the contact details into a form you can review and edit before saving. You can scan both sides for the most complete capture.',
  },
  {
    q: 'My scan closed without going to the next step — what happened?',
    a: 'Usually the photo couldn’t be read (a blurry shot, an unsupported format, or a very large image). You’ll now see a message when this happens — just tap to scan again with a clearer, well-lit photo. If it keeps happening, you can always enter the details manually below the scan area.',
  },
  {
    q: 'Are my Event Mode sessions saved?',
    a: 'Yes. When you end an event, CardDesk saves a snapshot — the event name, date, and everyone you met — to your event history, visible on the Event Mode start screen. The contacts themselves stay tagged with the event under “Where We Met” forever.',
  },
  {
    q: 'What are Earnest AI tokens / credits?',
    a: 'AI features (card reading, coaching, suggestions) draw on Earnest AI credits. New accounts start with free credits, and you can top up anytime from your Account page.',
  },
  {
    q: 'What is XP and the Earnest Score?',
    a: 'XP rewards networking activity — scanning cards, adding contacts, following up — and powers levels, streaks and badges. Your real CRM activity also contributes to your Earnest Score, a measure of networking consistency shown on your Account page.',
  },
  {
    q: 'Is my data private?',
    a: 'Your contacts and notes are private to your account. Your shareable CardDesk card is public by design (that’s the point of sharing it), but your network and pipeline are not.',
  },
]

const open = ref<number | null>(0)
function toggle(i: number) {
  open.value = open.value === i ? null : i
}
</script>

<template>
  <div class="help-page">
    <div class="help-container">
      <NuxtLink :to="loggedIn ? '/' : '/login'" class="cd-back">
        <CdIcon :emoji="loggedIn ? '✕' : '‹'" :icon="loggedIn ? 'lucide:x' : 'lucide:chevron-left'" :size="14" /> {{ loggedIn ? 'Close' : 'Back' }}
      </NuxtLink>

      <header class="help-hero">
        <div class="help-hero-ico"><CdIcon icon="lucide:life-buoy" :size="40" /></div>
        <h1 class="help-title">Help &amp; FAQ</h1>
        <p class="help-sub">Get the most out of CardDesk — quick guides and answers to common questions.</p>
      </header>

      <!-- ── Tutorials ── -->
      <section>
        <h2 class="help-sec-title"><CdIcon icon="lucide:graduation-cap" :size="14" /> Getting started</h2>
        <div class="help-tut-grid">
          <div v-for="t in tutorials" :key="t.title" class="help-tut glass-surface">
            <div class="help-tut-ico"><CdIcon :icon="t.icon" :size="22" /></div>
            <h3 class="help-tut-title">{{ t.title }}</h3>
            <p class="help-tut-body">{{ t.body }}</p>
          </div>
        </div>
      </section>

      <!-- ── FAQ ── -->
      <section>
        <h2 class="help-sec-title"><CdIcon icon="lucide:message-circle-question" :size="14" /> Frequently asked</h2>
        <div class="help-faq-list">
          <div v-for="(f, i) in faqs" :key="i" class="help-faq glass-thin" :class="{ open: open === i }">
            <button class="help-faq-q" @click="toggle(i)">
              <span>{{ f.q }}</span>
              <CdIcon icon="lucide:chevron-down" :size="16" class="help-faq-chev" />
            </button>
            <div v-show="open === i" class="help-faq-a">{{ f.a }}</div>
          </div>
        </div>
      </section>

      <!-- ── Still stuck ── -->
      <section class="help-cta glass-surface">
        <h2 class="help-cta-title">Still stuck or found a bug?</h2>
        <p class="help-cta-sub">
          <template v-if="loggedIn">Tell us what's up — it goes straight to the team.</template>
          <template v-else>Log in to send feedback from inside the app, or email us anytime.</template>
        </p>
        <button v-if="loggedIn" class="cd-abtn g help-cta-btn" @click="openFeedback('bug')">
          <CdIcon icon="lucide:message-square-plus" :size="15" /> Send feedback
        </button>
        <a v-else href="mailto:hello@earnest.guru" class="cd-abtn g help-cta-btn">
          <CdIcon icon="lucide:mail" :size="15" /> Email us
        </a>
      </section>

      <CdBrandFooter />
    </div>
  </div>
</template>

<style scoped>
.help-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: 'Barlow', sans-serif;
  padding: calc(env(safe-area-inset-top, 16px) + 16px) 16px 32px;
}
.help-container { max-width: 720px; margin: 0 auto; }

.help-hero { text-align: center; margin: 16px 0 28px; }
.help-hero-ico {
  width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center; color: var(--cd-green);
  background: color-mix(in srgb, var(--cd-green) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-green) 28%, transparent);
}
.help-title { font-family: 'Bebas Neue', sans-serif; font-size: 2.4rem; margin: 0; letter-spacing: 0.01em; }
.help-sub { font-size: 0.95rem; color: var(--cd-muted); margin: 4px auto 0; max-width: 460px; line-height: 1.5; }

.help-sec-title {
  display: flex; align-items: center; gap: 7px;
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 800;
  color: var(--cd-dim); margin: 28px 2px 12px;
}

/* shared frosted glass (mirrors EventModeScreen) */
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

/* tutorials */
.help-tut-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.help-tut { border-radius: 16px; padding: 18px; }
.help-tut-ico {
  width: 44px; height: 44px; border-radius: 50%; margin-bottom: 10px;
  display: flex; align-items: center; justify-content: center; color: var(--cd-green);
  background: color-mix(in srgb, var(--cd-green) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-green) 28%, transparent);
}
.help-tut-title { font-size: 1rem; font-weight: 800; margin: 0 0 6px; }
.help-tut-body { font-size: 0.85rem; line-height: 1.55; color: var(--cd-muted); margin: 0; }

/* faq accordion */
.help-faq-list { display: flex; flex-direction: column; gap: 8px; }
.help-faq { border-radius: 14px; overflow: hidden; }
.help-faq-q {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 15px 16px; background: transparent; border: none; cursor: pointer; text-align: left;
  font-size: 0.95rem; font-weight: 700; color: var(--cd-text); font-family: inherit;
}
.help-faq-chev { color: var(--cd-dim); transition: transform 0.2s ease; flex-shrink: 0; }
.help-faq.open .help-faq-chev { transform: rotate(180deg); }
.help-faq-a {
  padding: 0 16px 16px; font-size: 0.88rem; line-height: 1.6; color: var(--cd-muted);
}

/* cta */
.help-cta { border-radius: 18px; padding: 26px 22px; text-align: center; margin-top: 28px; }
.help-cta-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; margin: 0 0 6px; }
.help-cta-sub { font-size: 0.9rem; color: var(--cd-muted); line-height: 1.5; margin: 0 0 16px; }
.help-cta-btn { display: inline-flex; align-items: center; gap: 7px; }

@media (max-width: 560px) {
  .help-tut-grid { grid-template-columns: 1fr; }
}
</style>
