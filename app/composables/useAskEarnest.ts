import type { OpenChatOptions } from '~/composables/useChat'
import type { Screen } from '~/composables/useNavigation'

/**
 * Powers the floating "Ask Earnest" button. It reads the screen the user is on
 * (useNavigation) plus the relevant shared state and seeds a context-aware chat
 * — a contact on the detail screen, the live event in Event Mode, or a network
 * overview everywhere else. The /api/ai-chat endpoint also layers in the user's
 * profile + goal server-side, so every reply is grounded in their real data.
 *
 * Screens with richer context than the generic default (e.g. the contact detail
 * screen, which holds the full activity timeline) can publish a builder via
 * `provideContext(screen, fn)`; the button prefers it. Keyed by screen so a
 * builder never bleeds onto another page.
 */
const contextBuilders = new Map<Screen, () => OpenChatOptions | null>()

export function useAskEarnest() {
  const { screen, selectedId } = useNavigation()
  const { open, isOpen } = useChat()
  const { contacts } = useContacts()
  const { state: xp } = useXp()
  const { profile, fullName } = useProfile()
  const eventMode = useEventMode()
  const analytics = useAnalytics()

  // Hide while the chat panel is open (redundant) or on the full-screen scan
  // flow (its own pinned action bar would clash).
  const visible = computed(() => !isOpen.value && screen.value !== 'add')

  function networkSnapshot() {
    const cs = contacts.value as any[]
    const by = (r: string) => cs.filter((c) => c.rating === r).length
    return {
      total_contacts: cs.length,
      clients: cs.filter((c) => c.is_client).length,
      hot: by('hot'), warm: by('warm'), nurture: by('nurture'), cold: by('cold'),
      level: xp.value.level, total_xp: xp.value.total_xp, streak: xp.value.streak,
    }
  }

  function build(): OpenChatOptions {
    const s = screen.value

    // A screen that published a richer builder wins (e.g. contact detail).
    const custom = contextBuilders.get(s)
    if (custom) {
      const opts = custom()
      if (opts) return opts
    }

    // Contact detail fallback (if the detail screen hasn't registered yet).
    if (s === 'detail' && selectedId.value) {
      const c = (contacts.value as any[]).find((x) => x.id === selectedId.value)
      if (c) {
        return {
          scope: 'contact',
          title: c.name,
          contactId: c.id,
          context: {
            name: c.name, company: c.company, title: c.title, industry: c.industry,
            rating: c.rating, pipeline_stage: c.pipeline_stage, is_client: c.is_client,
            met_at: c.met_at, notes: c.notes,
          },
          focus: `the contact "${c.name}"${c.company ? ` from ${c.company}` : ''} they're looking at`,
          intro: `Let's talk about ${c.name}${c.company ? ` at ${c.company}` : ''}. Want your next move, a follow-up message, or help moving them through your pipeline?`,
        }
      }
    }

    // Event Mode → coach on the events they've worked.
    if (s === 'event') {
      const live = eventMode.active.value
      return {
        scope: 'events',
        title: live ? eventMode.name.value : 'Your events',
        context: { active_event: live ? eventMode.name.value : null, met_here: eventMode.count.value, ...networkSnapshot() },
        focus: live ? `the live event "${eventMode.name.value}" they're working` : 'their networking events',
        intro: live
          ? `You're working ${eventMode.name.value}. Want tips to work the room, or who to prioritize as you go?`
          : `Want help getting ROI from your events — who to follow up with first, or patterns across them?`,
      }
    }

    // Everywhere else → general coach grounded in their whole network.
    const where: Record<string, string> = {
      vibe: 'their Vibe dashboard', home: 'their Stats', contacts: 'their Network list',
      feed: 'their activity Feed', session: 'a coaching Session', cold: 'their cold contacts',
    }
    const first = fullName.value ? ` ${fullName.value.split(' ')[0]}` : ''
    return {
      scope: 'general',
      title: 'Ask Earnest',
      context: networkSnapshot(),
      focus: where[s] ?? 'their CardDesk',
      intro: `Hey${first} — what do you want to work on? I can spot who to reconnect with, plan your week, or sharpen your outreach.`,
    }
  }

  function ask() {
    analytics.aiFeatureUse('chat')
    open(build())
  }

  /** Register a richer context builder for a screen (call from that screen). */
  function provideContext(s: Screen, fn: () => OpenChatOptions | null) {
    contextBuilders.set(s, fn)
  }
  function clearContext(s: Screen) {
    contextBuilders.delete(s)
  }

  return { visible, ask, provideContext, clearContext }
}
