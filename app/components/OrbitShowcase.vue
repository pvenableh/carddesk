<script setup lang="ts">
/**
 * Self-contained marketing showcase of the Network Orbit — 22 fake connections
 * with real-looking portrait photos and varied industries. No auth / API: it
 * builds its own data so it can be dropped into a landing page or sell sheet.
 *
 * Surface uses the same liquid-glass recipe as the sell sheet's .lp-glass
 * widgets (tinted gradient + backdrop blur over a translucent base), driven by
 * the global --glass-* theme variables, so it matches the rest of the page.
 *
 * Portraits come from randomuser.me (free, stable, no key).
 */
import type { NetworkConnection } from '~/composables/useConnections'
import { INDUSTRY_COLORS } from '~/composables/useConstants'
import NetworkOrbit from '~/components/phone/NetworkOrbit.vue'

const AVATAR = (path: string) => `https://randomuser.me/api/portraits/${path}.jpg`

// name · title · industry (drives node color) · portrait
const PEOPLE = [
  { name: 'Maya Chen',      title: 'Product Lead',       industry: 'Technology',      img: 'women/68' },
  { name: 'Daniel Okafor',  title: 'Managing Partner',   industry: 'Venture Capital', img: 'men/32' },
  { name: 'Sofia Marin',    title: 'Brand Director',     industry: 'Marketing',       img: 'women/44' },
  { name: 'Liam Walsh',     title: 'Founder & CEO',      industry: 'Technology',      img: 'men/75' },
  { name: 'Emily Carter',   title: 'Investor',           industry: 'Finance',         img: 'women/12' },
  { name: 'Marcus Bell',    title: 'Broker',             industry: 'Real Estate',     img: 'men/14' },
  { name: 'Elena Petrova',  title: 'General Counsel',    industry: 'Legal',           img: 'women/29' },
  { name: 'Noah Kim',       title: 'Growth Lead',        industry: 'Marketing',       img: 'men/45' },
  { name: 'Aisha Rahman',   title: 'Surgeon',            industry: 'Healthcare',      img: 'women/65' },
  { name: 'Tomás Rivera',   title: 'CFO',                industry: 'Finance',         img: 'men/22' },
  { name: 'Hannah Berg',    title: 'Principal',          industry: 'Venture Capital', img: 'women/33' },
  { name: 'Kenji Watanabe', title: 'Staff Engineer',     industry: 'Technology',      img: 'men/60' },
  { name: 'Grace Adeyemi',  title: 'Realtor',            industry: 'Real Estate',     img: 'women/90' },
  { name: 'Oliver Stone',   title: 'Attorney',           industry: 'Legal',           img: 'men/52' },
  { name: 'Lucia Romano',   title: 'Physician',          industry: 'Healthcare',      img: 'women/57' },
  { name: 'Ethan Brooks',   title: 'Consultant',         industry: 'Other',           img: 'men/3' },
  { name: 'Zara Ali',       title: 'CMO',                industry: 'Marketing',       img: 'women/9' },
  { name: 'Felix Hartmann', title: 'Analyst',            industry: 'Finance',         img: 'men/85' },
  { name: 'Nadia Haddad',   title: 'Partner',            industry: 'Legal',           img: 'women/76' },
  { name: 'Ryan Cooper',    title: 'Engineer',           industry: 'Technology',      img: 'men/41' },
  { name: 'Ingrid Larsen',  title: 'Advisor',            industry: 'Other',           img: 'women/50' },
  { name: 'Carlos Mendes',  title: 'Investor',           industry: 'Venture Capital', img: 'men/18' },
]

// Build NetworkConnection rows. Activity (totalXp/weekXp) + recency rank the
// orbit; we vary them so the front-to-back depth reads naturally. Dates are
// fixed strings (not Date.now()) so SSR and client render identically.
const connections: NetworkConnection[] = PEOPLE.map((p, i) => ({
  id: `showcase-${i}`,
  status: 'accepted',
  direction: null,
  since: `2026-05-${String(28 - (i % 26)).padStart(2, '0')}T12:00:00Z`,
  updated: `2026-06-${String(28 - i).padStart(2, '0')}T12:00:00Z`,
  user: {
    id: `showcase-u-${i}`,
    name: p.name,
    title: p.title,
    avatarUrl: AVATAR(p.img),
    industry: p.industry,
    level: Math.max(1, 9 - Math.floor(i / 3)),
    totalXp: 3200 - i * 128 + (i % 3) * 70,
    weekXp: (i % 5) * 45,
    lastActivityDate: null,
  },
}))

const me = { name: 'You', level: 8 }
const meAvatarUrl = AVATAR('women/79')

// Legend: the industries actually present, in first-appearance order.
const legend = [...new Set(PEOPLE.map((p) => p.industry))].map((name) => ({
  name,
  color: INDUSTRY_COLORS[name] ?? 'var(--cd-muted)',
}))

const selectedName = ref<string | null>(null)
</script>

<template>
  <div class="os-card lp-glass-self">
    <div class="os-head">
      <span class="os-title"><CdIcon emoji="🪐" icon="lucide:orbit" :size="15" /> Your Orbit</span>
      <span class="os-tag">{{ connections.length }} connections</span>
    </div>

    <NetworkOrbit
      :connections="connections"
      :me="me"
      :me-avatar-url="meAvatarUrl"
      avatar-dots
      @select="selectedName = $event.user.name"
    />

    <div class="os-legend">
      <span v-for="l in legend" :key="l.name" class="os-chip">
        <span class="os-dot" :style="{ background: l.color }"></span>{{ l.name }}
      </span>
    </div>
    <div class="os-note">
      Color = industry · size = how active they are · hover to pause
    </div>
  </div>
</template>

<style scoped>
.os-card {
  --center-fallback: var(--cd-bg2);
  max-width: 440px;
  margin: 0 auto;
  border-radius: 24px;
  padding: 16px 16px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* ── Liquid-glass surface — mirrors the sell sheet's .lp-glass recipe so this
 *    widget sits flush with the others (tinted gradient + backdrop blur). ── */
.lp-glass-self {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  box-shadow: var(--glass-shadow, 0 10px 28px -14px rgba(16, 24, 40, 0.08));
}
html[data-theme='glass'][data-mode='dark'] .lp-glass-self {
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
html[data-theme='glass'][data-mode='light'] .lp-glass-self {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h) var(--glass-s) 60% / 0.10) 0%,
      hsl(var(--glass-h) var(--glass-s) 50% / 0.03) 50%,
      hsl(var(--glass-h2) var(--glass-s) 55% / 0.08) 100%),
    rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid hsl(var(--glass-h) 40% 50% / 0.12);
  box-shadow: var(--glass-inset), var(--glass-shadow);
}

/* Compact widget header (matches the leaderboard card's head row). */
.os-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 0;
}
.os-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--cd-text);
}
.os-tag {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--cd-muted);
  background: color-mix(in srgb, var(--cd-muted) 14%, transparent);
  padding: 3px 9px;
  border-radius: 999px;
}

/* Industry legend chips. */
.os-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px 8px;
  padding: 2px 4px;
}
.os-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--cd-muted);
}
.os-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.os-note {
  font-size: 0.68rem;
  color: var(--cd-dim);
  font-weight: 600;
  text-align: center;
}
</style>
