/**
 * Global control for the app's feedback slide-up sheet. A single
 * <CdFeedbackSheet> is mounted in app.vue, so any button anywhere (avatar menu,
 * help page, account) can pop it open without navigating away — the user
 * submits and carries on with whatever they were doing.
 */
export type FeedbackKind = 'bug' | 'idea' | 'other'

export function useFeedbackSheet() {
  const open = useState('cd-feedbacksheet-open', () => false)
  const kind = useState<FeedbackKind>('cd-feedbacksheet-kind', () => 'bug')
  function show(k: FeedbackKind = 'bug') {
    kind.value = k
    open.value = true
  }
  function hide() {
    open.value = false
  }
  return { open, kind, show, hide }
}
