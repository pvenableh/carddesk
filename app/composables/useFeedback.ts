/**
 * App feedback & bug reports. Persists to the existing `cd_feedback` collection
 * (the same one used for AI thumbs up/down) via POST /api/feedback — no new
 * backend collection or permission needed. We distinguish report types with the
 * `source` field (`bug` | `idea` | `other`) and stash the message + a little
 * client context (page, viewport, UA) in `note` so we can reproduce issues.
 */
export type FeedbackKind = 'bug' | 'idea' | 'other'

export function useFeedback() {
  const submitting = ref(false)

  async function submitReport(kind: FeedbackKind, message: string): Promise<void> {
    const text = message.trim()
    if (!text) throw new Error('Please add a few words first')
    submitting.value = true
    try {
      const context = import.meta.client
        ? `\n\n— sent from ${location.pathname} · ${window.innerWidth}×${window.innerHeight} · ${navigator.userAgent}`
        : ''
      await $fetch('/api/feedback', {
        method: 'POST',
        body: { source: kind, note: text + context },
      })
    } finally {
      submitting.value = false
    }
  }

  return { submitting, submitReport }
}
