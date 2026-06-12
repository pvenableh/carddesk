/**
 * Canonical icon registry — the single source of truth for icon names across
 * CardDesk. Always Lucide (universal SVG, identical on every OS); never OS
 * emoji. Reference these instead of hardcoding `'lucide:...'` strings so every
 * concept has exactly one icon, defined in one place.
 *
 *   <CdIcon :icon="ICON.stage.client" :size="20" />   // color via parent `color`
 *
 * Auto-imported by Nuxt (no import needed in components).
 */
export const ICON = {
  nav: {
    vibe: 'lucide:zap',
    session: 'lucide:mic',
    stats: 'lucide:bar-chart-3',
    network: 'lucide:users',
    scan: 'lucide:scan',
    play: 'lucide:layout-grid',
  },
  stage: {
    new: 'lucide:plus-circle',
    warming: 'lucide:flame',
    opportunity: 'lucide:target',
    client: 'lucide:badge-check',
    partner: 'lucide:handshake',
    lost: 'lucide:circle-x',
  },
  action: {
    share: 'lucide:share-2',
    next: 'lucide:arrow-right',
    add: 'lucide:plus',
    edit: 'lucide:pencil',
    remove: 'lucide:trash-2',
    sparkles: 'lucide:sparkles',
    wand: 'lucide:wand-sparkles',
    grip: 'lucide:grip-vertical',
    reset: 'lucide:rotate-ccw',
    scanLine: 'lucide:scan-line',
  },
  reward: {
    star: 'lucide:star',
    xp: 'lucide:star',
    trophy: 'lucide:trophy',
    flame: 'lucide:flame',
    celebrate: 'lucide:party-popper',
  },
  contact: {
    mail: 'lucide:mail',
    phone: 'lucide:phone',
    orbit: 'lucide:orbit',
    snooze: 'lucide:moon',
    card: 'lucide:id-card',
  },
} as const
