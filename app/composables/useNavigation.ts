export type Screen = "vibe" | "session" | "cold" | "home" | "contacts" | "detail" | "add"

export function useNavigation() {
  const screen = useState<Screen>("cd-screen", () => "vibe")
  const selectedId = useState<string | null>("cd-selectedId", () => null)
  const editing = useState("cd-editing", () => false)

  function nav(s: Screen) {
    screen.value = s
  }

  function goDetail(id: string) {
    selectedId.value = id
    editing.value = false
    nav("detail")
  }

  return { screen, selectedId, editing, nav, goDetail }
}
