import { MISSIONS } from '~/composables/useConstants'

export const LEVELS = [
  { level: 1, title: 'Rookie', xp: 0 },
  { level: 2, title: 'Hustler', xp: 200 },
  { level: 3, title: 'Connector', xp: 500 },
  { level: 4, title: 'Player', xp: 1000 },
  { level: 5, title: 'Rainmaker', xp: 2000 },
  { level: 6, title: 'Closer', xp: 5000 },
  { level: 7, title: 'Networker', xp: 10000 },
  { level: 8, title: 'Dealmaker', xp: 20000 },
  { level: 9, title: 'Legend', xp: 50000 },
]

const BADGE_CHECKS: Record<string, (s: any) => boolean> = {
  card_shark: (s) => s.total_scans >= 5,
  hot_streak: (s) => s.streak >= 7,
  speed_dialer: (s) => s.fast_followups >= 1,
  networker: (s) => s.total_contacts >= 10,
  dealmaker: (s) => s.hot_responses >= 1,
  connector: (s) => s.intros >= 3,
  recruiter: (s) => (s.invites_accepted ?? 0) >= 3,
  closer: (s) => s.total_clients >= 1,
  legend: (s) => s.level >= 9,
  pipeline_builder: (s) => (s.pipeline_contacts ?? 0) >= 10,
  qualifier: (s) => (s.qualified_count ?? 0) >= 5,
  proposal_pro: (s) => (s.proposals_sent ?? 0) >= 3,
  deal_closer: (s) => (s.deals_won ?? 0) >= 3,
  pipeline_honest: (s) => (s.lost_reasons_logged ?? 0) >= 5,
}

const DEFAULT = {
  total_xp: 0, level: 1, streak: 0, last_activity_date: '',
  total_scans: 0, total_contacts: 0, total_clients: 0, fast_followups: 0, hot_responses: 0, intros: 0, invites_accepted: 0,
  pipeline_contacts: 0, qualified_count: 0, proposals_sent: 0, deals_won: 0, lost_reasons_logged: 0,
  week_xp: 0, week_start: '',
  streak_shields: 0,
  unlocked_badges: [] as string[], completed_missions: [] as string[], missions_date: '', hype_date: '', quiz_date: '',
}

/** Most shields a user can bank — scarcity keeps them feeling earned. */
export const MAX_STREAK_SHIELDS = 2

/** Monday (YYYY-MM-DD) of the given date's week — the bucket for week_xp. */
function weekStartStr(d = new Date()): string {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // 0 = Monday
  x.setDate(x.getDate() - day)
  return x.toISOString().slice(0, 10)
}

export function useXp() {
  const state = useState('cd_xp', () => ({ ...DEFAULT }))
  const toast = useState<{ icon: string; xp: string; msg: string } | null>('cd_xp_toast', () => null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  const curLevel  = computed(() => LEVELS.find((l) => l.level === state.value.level) ?? LEVELS[0])
  const nextLevel = computed(() => LEVELS.find((l) => l.level === state.value.level + 1) ?? null)
  const xpPct     = computed(() => {
    if (!nextLevel.value) return 100
    const c = curLevel.value.xp, n = nextLevel.value.xp
    return Math.min(100, Math.round(((state.value.total_xp - c) / (n - c)) * 100))
  })

  function showToast(icon: string, xp: string, msg: string) {
    toast.value = { icon, xp, msg }
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = null), 2500)
  }

  function earn(amount: number, icon: string, msg: string, extras: Record<string, any> = {}) {
    const s = state.value
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const { emit: emitFeed } = useFeed()
    const prevLevel = s.level
    const wk = weekStartStr()
    if (s.week_start !== wk) { s.week_start = wk; s.week_xp = 0 }
    s.total_xp += amount
    s.week_xp = (s.week_xp ?? 0) + amount
    Object.assign(s, extras)
    for (let i = LEVELS.length - 1; i >= 0; i--)
      if (s.total_xp >= LEVELS[i].xp) { s.level = LEVELS[i].level; break }
    if (s.level > prevLevel) emitFeed('level_up', { level: s.level })
    if (s.last_activity_date !== today) {
      const dayBefore = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
      if (s.last_activity_date === yesterday) {
        s.streak += 1
      } else if (s.streak > 0 && (s.streak_shields ?? 0) > 0 && s.last_activity_date === dayBefore) {
        // Exactly one missed day and a shield in the bank: the streak survives.
        // A hard reset to 1 is the #1 rage-quit moment in streak systems —
        // recovery, not punishment, is the house style here.
        s.streak_shields -= 1
        s.streak += 1
        useToast().info(`🛡️ Streak shield used — your ${s.streak}-day streak survived the missed day.`)
      } else {
        s.streak = 1
      }
      s.last_activity_date = today
      if (s.streak === 7) {
        s.total_xp += 200; s.week_xp += 200
        // A 7-day streak also banks a shield — consistency earns resilience.
        s.streak_shields = Math.min(MAX_STREAK_SHIELDS, (s.streak_shields ?? 0) + 1)
        showToast('🔥', '+200 XP', '7-day streak bonus + a streak shield!')
        emitFeed('streak', { days: 7 })
      }
    }
    for (const [key, check] of Object.entries(BADGE_CHECKS)) {
      if (!s.unlocked_badges.includes(key) && check(s)) {
        s.unlocked_badges.push(key); s.total_xp += 75; s.week_xp += 75
        showToast('🏅', '+75 XP', `${key.replace('_', ' ')} unlocked!`)
        emitFeed('badge', { badge: key })
      }
    }
    if (s.missions_date !== today) { s.completed_missions = []; s.missions_date = today }
    showToast(icon, `+${amount} XP`, msg)
    syncXp()
  }

  /**
   * Mark a daily mission complete from the real action that fulfils it.
   * Missions are verified, not self-reported — call sites are the actual earn
   * moments (scan, follow-up, response, …), never a checkbox tap. Awards the
   * mission's bonus XP on top of the action's own XP, once per day.
   */
  function completeMission(key: string) {
    const s = state.value
    const today = new Date().toISOString().slice(0, 10)
    if (s.missions_date !== today) { s.completed_missions = []; s.missions_date = today }
    if (s.completed_missions.includes(key)) return
    const m = MISSIONS.find((x) => x.key === key)
    if (!m) return
    s.completed_missions.push(key)
    earn(m.xp, '🎯', `Mission complete: ${m.label}`)
  }

  function deduct(amount: number, icon: string, msg: string, extras: Record<string, any> = {}) {
    const s = state.value
    s.total_xp = Math.max(0, s.total_xp - amount)
    Object.assign(s, extras)
    for (let i = LEVELS.length - 1; i >= 0; i--)
      if (s.total_xp >= LEVELS[i].xp) { s.level = LEVELS[i].level; break }
    showToast(icon, `-${amount} XP`, msg)
    syncXp()
  }

  async function syncXp() {
    try { await $fetch('/api/xp', { method: 'POST', body: state.value }) }
    catch { if (import.meta.client) localStorage.setItem('cd_xp_backup', JSON.stringify(state.value)) }
  }

  async function loadXp() {
    try {
      const data = await $fetch<typeof DEFAULT>('/api/xp')
      if (data) state.value = data
    } catch {
      if (import.meta.client) {
        const b = localStorage.getItem('cd_xp_backup')
        if (b) try { state.value = JSON.parse(b) } catch {}
      }
    }
  }

  return { state, toast, curLevel, nextLevel, xpPct, earn, deduct, completeMission, loadXp }
}
