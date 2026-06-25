/**
 * "Present my card" — a full-screen takeover with a big, instantly-scannable QR
 * of the user's card. The fast path for showing your card to someone in person:
 * one tap from the header (or launched straight from the PWA home-screen
 * shortcut), no modal/tab digging.
 */
export function usePresentCard() {
  const open = useState('cd-present-open', () => false)
  function show() {
    open.value = true
  }
  function hide() {
    open.value = false
  }
  return { open, show, hide }
}
