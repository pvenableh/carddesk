export type ShareTab = 'card' | 'invite'

/**
 * Global control for the app's ShareSheet (My Card / Invite). A single
 * <PhoneShareSheet> is mounted in the app shell; any button anywhere opens it
 * via show('card' | 'invite').
 */
export function useShareSheet() {
  const open = useState('cd-sharesheet-open', () => false)
  const tab = useState<ShareTab>('cd-sharesheet-tab', () => 'card')
  function show(t: ShareTab = 'card') {
    tab.value = t
    open.value = true
  }
  function hide() {
    open.value = false
  }
  return { open, tab, show, hide }
}
