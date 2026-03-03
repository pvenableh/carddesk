export const RATINGS = [
  { key: "hot", label: "Hot", emoji: "🔥", color: "#ff6b35" },
  { key: "warm", label: "Warm", emoji: "👍", color: "#ffe033" },
  { key: "nurture", label: "Nurture", emoji: "🌱", color: "#00c268" },
  { key: "cold", label: "Cold", emoji: "❄️", color: "#4da6ff" },
] as const

export const ACT_TYPES = [
  { key: "email", label: "Email", icon: "📧" },
  { key: "text", label: "Text", icon: "📱" },
  { key: "call", label: "Call", icon: "📞" },
  { key: "meeting", label: "Meeting", icon: "🤝" },
  { key: "linkedin", label: "LinkedIn", icon: "🔗" },
  { key: "other", label: "Other", icon: "💬" },
] as const

export const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Real Estate",
  "Legal",
  "Marketing",
  "Venture Capital",
  "Other",
] as const

export const EMOJIS = [
  "🐯", "🦁", "🦊", "🐺", "🦋", "🐬",
  "🦉", "🦝", "🐠", "🦌", "🦅", "🌊",
] as const

export const MISSIONS = [
  { key: "scan", icon: "📷", label: "Scan a Business Card", hype: "Done. Like a machine.", xp: 50 },
  { key: "followup", icon: "✉️", label: "Log a Follow-up", hype: "They'll remember you.", xp: 25 },
  { key: "hot", icon: "🔥", label: "Follow Up a Hot Lead", hype: "Don't leave them hanging.", xp: 50 },
  { key: "response", icon: "✅", label: "Log a Response", hype: "They came back. Of course they did.", xp: 100 },
] as const

export const BADGES = [
  { key: "card_shark", emoji: "🃏", label: "Card Shark", desc: "Scan 5 cards" },
  { key: "hot_streak", emoji: "🔥", label: "Hot Streak", desc: "7-day streak" },
  { key: "speed_dialer", emoji: "⚡", label: "Speed Dialer", desc: "Follow up within 24h" },
  { key: "networker", emoji: "🌐", label: "Networker", desc: "Add 10 contacts" },
  { key: "dealmaker", emoji: "💎", label: "Dealmaker", desc: "Response from Hot lead" },
  { key: "connector", emoji: "🌉", label: "Connector", desc: "Make 3 intros" },
  { key: "legend", emoji: "👑", label: "Legend", desc: "Reach Level 9" },
] as const

export const VIBE_MOODS = [
  { e: "😶‍🌫️", title: "Feeling antisocial?", color: "blue", body: "One message. You don't have to be 'on' — just human." },
  { e: "🔥", title: "You are killing it.", color: "green", body: "Contacts growing, streak alive. This is real momentum." },
  { e: "😴", title: "A little tired today?", color: "blue", body: "A 2-second reaction keeps the connection warm." },
  { e: "🏆", title: "You are brilliant at this.", color: "green", body: "You show up and follow through. That's rare." },
  { e: "🛋️", title: "Introverted this week?", color: "purple", body: "3 hot leads. One message each. Done in 5 minutes." },
] as const

export const TOUGH_CARDS = [
  { q: "Your hot leads are going cold right now.", b: "These conversations could change things. <em>One text.</em> Not five. <strong>One.</strong>" },
  { q: "The follow-up window does not stay open forever.", b: "It's still open <em>right now.</em> You'll feel better the second you hit send." },
  { q: "Your streak is worth protecting tonight.", b: "You've been showing up. Don't break it. One touchpoint. Just <em>real.</em>" },
] as const

export const HYPE_CARDS = [
  { q: "Your response rate is well above average.", b: "People reply because <strong>you're worth their time.</strong> Go remind someone you exist." },
  { q: "You are in the top tier of networkers.", b: "You show up, follow through, make people feel seen. <strong>Own it.</strong>" },
  { q: "Every great connection started with one message.", b: "Not a pitch deck. Not a post. <em>One message.</em> <strong>Do it again.</strong>" },
] as const

export const COLD_WARMERS = [
  "Maybe they just need time to thaw out. You met for a reason.",
  "Slow burns lead to the best leads. Your patience is a competitive advantage.",
  "Maybe they're just busy — remind them how you can help.",
] as const

export const RATING_ORDER: Record<string, number> = { hot: 0, warm: 1, nurture: 2, cold: 3 }

export function getRating(k: string) {
  return RATINGS.find((r) => r.key === k) ?? null
}

export function getAct(k: string) {
  return ACT_TYPES.find((a) => a.key === k) ?? ACT_TYPES[5]
}

export function cEmoji(c: any) {
  const id = c.id ?? ""
  return EMOJIS[Math.abs((id.charCodeAt(0) || 0) + (id.charCodeAt(1) || 0)) % EMOJIS.length]
}

export function coldWarmer(c: any) {
  return COLD_WARMERS[Math.abs((c.id ?? "").charCodeAt(0) || 0) % COLD_WARMERS.length]
}
