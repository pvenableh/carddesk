export type Screen = "vibe" | "session" | "cold" | "home" | "contacts" | "detail" | "add" | "event" | "feed" | "chat"

// `event` and `feed` are now primary bottom-nav tabs, so they animate as tabs
// (slide by index) rather than as pushed sub-screens. `chat` is a pushed
// sub-screen opened from contextual AI helpers.
const PUSH_SCREENS = new Set<Screen>(["detail", "add", "cold", "chat"])
const TAB_INDEX: Record<string, number> = {
  vibe: 0, session: 1, event: 2, feed: 3, home: 4, contacts: 5,
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
