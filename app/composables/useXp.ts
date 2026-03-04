const LEVELS = [
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
  closer: (s) => s.total_clients >= 1,
  legend: (s) => s.level >= 9,
}

const DEFAULT = {
  total_xp: 0, level: 1, streak: 0, last_activity_date: '',
  total_scans: 0, total_contacts: 0, total_clients: 0, fast_followups: 0, hot_responses: 0, intros: 0,
  unlocked_badges: [] as string[], completed_missions: [] as string[], missions_date: '',
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
    s.total_xp += amount
    Object.assign(s, extras)
    for (let i = LEVELS.length - 1; i >= 0; i--)
      if (s.total_xp >= LEVELS[i].xp) { s.level = LEVELS[i].level; break }
    if (s.last_activity_date !== today) {
      s.streak = s.last_activity_date === yesterday ? s.streak + 1 : 1
      s.last_activity_date = today
      if (s.streak === 7) { s.total_xp += 200; showToast('🔥', '+200 XP', '7-day streak bonus!') }
    }
    for (const [key, check] of Object.entries(BADGE_CHECKS)) {
      if (!s.unlocked_badges.includes(key) && check(s)) {
        s.unlocked_badges.push(key); s.total_xp += 75
        showToast('🏅', '+75 XP', `${key.replace('_', ' ')} unlocked!`)
      }
    }
    if (s.missions_date !== today) { s.completed_missions = []; s.missions_date = today }
    showToast(icon, `+${amount} XP`, msg)
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

  return { state, toast, curLevel, nextLevel, xpPct, earn, loadXp }
}
