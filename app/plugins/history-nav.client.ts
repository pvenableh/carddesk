import type { Screen } from '~/composables/useNavigation'

/**
 * Browser back/forward for the in-app screen state.
 *
 * The authenticated app is a single route (`/`) whose "screens" — vibe,
 * contacts, detail, the Earnest chat sheet, etc. — are swapped by reactive
 * state in useNavigation/useChat/useEventMode, not by the router. So without
 * this bridge the browser history stack for a logged-in user is basically just
 * `[login, /]`, and pressing back exits the whole app (and used to bounce to
 * /login). Users expect back to walk *between* the screens they visited and to
 * dismiss an open sheet first.
 *
 * We mirror the view into the URL query (`?s=contacts`, `?c=<id>`, `?chat=1`,
 * `?event=1`) and drive it through vue-router. Going through the router (rather
 * than raw history.pushState) is deliberate: pushState would overwrite
 * vue-router's own history.state and break its back/forward + scroll tracking.
 * Each forward navigation router.push()es a new query → a real history entry;
 * back/forward changes route.query → we replay it onto the view state.
 *
 * Only active while logged in and on `/` — the logged-out landing and the real
 * sub-routes (/account, /card/edit) are left entirely to the router.
 */

interface View {
  screen: Screen
  selectedId: string | null
  chat: boolean
  event: boolean
}

const SCREENS = new Set<Screen>([
  'vibe', 'session', 'cold', 'home', 'contacts', 'detail', 'add', 'feed', 'chat', 'history',
])
// Only these screens carry a selected contact id in the URL.
const ID_SCREENS = new Set<Screen>(['detail', 'cold'])

function keyOf(v: View): string {
  return `${v.screen}|${v.selectedId ?? ''}|${v.chat ? 1 : 0}|${v.event ? 1 : 0}`
}

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const route = useRoute()
  const { loggedIn } = useUserSession()
  const { screen, selectedId, nav } = useNavigation()
  // Read the slide-up sheets straight from their shared state keys so we don't
  // instantiate the full useChat()/useEventMode() composables (and their
  // side-effecting dependencies) just to observe an open/closed flag.
  const chatOpen = useState<boolean>('cd-chat-open', () => false)
  const eventOpen = useState<boolean>('cd-event-panel', () => false)

  const snapshot = (): View => ({
    screen: screen.value,
    selectedId: selectedId.value,
    chat: chatOpen.value,
    event: eventOpen.value,
  })
  const viewKey = computed(() => keyOf(snapshot()))

  // View → query. Defaults (vibe / no selection / sheets closed) are omitted so
  // the common case stays a clean `/`.
  function queryFromState(): Record<string, string> {
    const q: Record<string, string> = {}
    if (screen.value !== 'vibe') q.s = screen.value
    if (selectedId.value && ID_SCREENS.has(screen.value)) q.c = selectedId.value
    if (chatOpen.value) q.chat = '1'
    if (eventOpen.value) q.event = '1'
    return q
  }

  // Query → view. Anything unrecognised collapses to the default vibe screen.
  function stateFromQuery(q: typeof route.query): View {
    const s = (typeof q.s === 'string' && SCREENS.has(q.s as Screen)) ? (q.s as Screen) : 'vibe'
    return {
      screen: s,
      selectedId: typeof q.c === 'string' && ID_SCREENS.has(s) ? q.c : null,
      chat: q.chat === '1',
      event: q.event === '1',
    }
  }

  function sameOurQuery(a: Record<string, any>, b: Record<string, any>): boolean {
    return a.s === b.s && a.c === b.c && a.chat === b.chat && a.event === b.event
  }

  // Apply a restored view without re-pushing it to history (the entry already
  // exists — this *is* the back/forward target). nav() reuses the screen's own
  // directional transition, so a back from detail→contacts slides right.
  function applyState(t: View) {
    selectedId.value = t.selectedId
    nav(t.screen)
    chatOpen.value = t.chat
    eventOpen.value = t.event
  }

  let applyingFromRoute = false

  // State → URL: a forward navigation pushes a new history entry.
  watch(viewKey, () => {
    if (applyingFromRoute || !loggedIn.value || route.path !== '/') return
    const q = queryFromState()
    if (sameOurQuery(q, route.query)) return
    router.push({ path: '/', query: q })
  })

  // URL → state: back/forward (and the initial load / a bookmarked deep link)
  // replay the query onto the view. immediate so a `/?s=contacts` entry point
  // lands on the right screen.
  watch(
    () => route.fullPath,
    () => {
      if (!loggedIn.value || route.path !== '/') return
      const target = stateFromQuery(route.query)
      if (keyOf(target) === viewKey.value) return
      applyingFromRoute = true
      applyState(target)
      nextTick(() => { applyingFromRoute = false })
    },
    { immediate: true },
  )
})
