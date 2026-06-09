/** Global control for the scoring cheat-sheet flyout. */
export function useScoreGuide() {
  const open = useState('cd-scoreguide-open', () => false)
  return {
    open,
    show: () => (open.value = true),
    hide: () => (open.value = false),
  }
}
