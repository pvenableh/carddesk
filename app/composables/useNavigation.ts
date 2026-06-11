export type Screen = "vibe" | "session" | "cold" | "home" | "contacts" | "detail" | "add" | "feed" | "chat" | "history"

// Bottom-nav screens animate as tabs (slide by their bar position). `add` (the
// scan button) sits in the middle of the bar, so it's a tab here too —
// otherwise scan↔feed slid the wrong way. `detail`/`cold`/`session` are pushed
// sub-screens; `chat` is a slide-up overlay handled outside this system.
// Session left the bar in the 7→5 nav consolidation and is reached from the
// Vibe screen. Event Mode is a slide-up panel (like chat) owned by
// useEventMode.panelOpen, not a screen here.
const PUSH_SCREENS = new Set<Screen>(["detail", "cold", "chat", "session", "history"])
// Must mirror NAV_ORDER in BottomNav.vue so the slide direction matches the
// visual left→right position of each tab: vibe · network · scan · feed · stats.
const TAB_INDEX: Record<string, number> = {
  vibe: 0, contacts: 1, add: 2, feed: 3, home: 4,
}

export function useNavigation() {
  const screen = useState<Screen>("cd-screen", () => "vibe")
  const selectedId = useState<string | null>("cd-selectedId", () => null)
  const editing = useState("cd-editing", () => false)
  const transitionName = useState("cd-transition", () => "cd-fade")

  function nav(s: Screen) {
    const from = screen.value
    if (from === s) return

    const fromPush = PUSH_SCREENS.has(from)
    const toPush = PUSH_SCREENS.has(s)

    if (!fromPush && toPush) {
      transitionName.value = "cd-slide-left"
    } else if (fromPush && !toPush) {
      transitionName.value = "cd-slide-right"
    } else if (!fromPush && !toPush) {
      const fromIdx = TAB_INDEX[from] ?? 0
      const toIdx = TAB_INDEX[s] ?? 0
      transitionName.value = toIdx > fromIdx ? "cd-slide-left" : toIdx < fromIdx ? "cd-slide-right" : "cd-fade"
    } else {
      transitionName.value = "cd-fade"
    }

    screen.value = s
  }

  function goDetail(id: string) {
    selectedId.value = id
    editing.value = false
    nav("detail")
  }

  return { screen, selectedId, editing, transitionName, nav, goDetail }
}
