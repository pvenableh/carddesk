import type { CdContact, CdActivity } from '~/types/directus'

export function useContacts() {
  const contacts = useState<CdContact[]>('cd_contacts', () => [])
  const analytics = useAnalytics()
  // Shared (not per-call) so screens can render a real error + retry state. A
  // failed load used to leave an empty list that read as "you have no
  // contacts" — the worst possible failure for an app holding someone's network.
  const loading = useState('cd_contacts_loading', () => false)
  const error = useState<string | null>('cd_contacts_error', () => null)

  // `silent` skips the shared loading/error toggles so a background reconcile
  // (e.g. after logging a touchpoint or closing an Earnest chat) never flashes
  // the list's spinner or trips its empty/error state if it happens to fail.
  async function fetchContacts(opts?: { silent?: boolean }) {
    if (!opts?.silent) { loading.value = true; error.value = null }
    try { contacts.value = await $fetch<CdContact[]>('/api/contacts') }
    catch (err: any) { if (!opts?.silent) error.value = err?.data?.message ?? 'Failed to load contacts' }
    finally { if (!opts?.silent) loading.value = false }
  }

  async function createContact(payload: Partial<CdContact>): Promise<CdContact> {
    const contact = await $fetch<CdContact>('/api/contacts', { method: 'POST', body: payload })
    const now = new Date().toISOString().slice(0, 10)
    let activity: CdActivity | null = null
    try {
      activity = await $fetch<CdActivity>('/api/activities', {
        method: 'POST',
        body: {
          contact: contact.id,
          type: 'contact_added',
          label: 'Added to network',
          date: now,
          note: payload.met_at ? `Met at ${payload.met_at}` : null,
        },
      })
    } catch (err: any) {
      console.error('[useContacts] Failed to log contact_added activity:', err?.data?.message ?? err)
    }
    contacts.value = [{ ...contact, activities: activity ? [activity] : [] }, ...contacts.value]
    analytics.contactCreate()
    return contact
  }

  async function updateContact(id: string, payload: Partial<CdContact>) {
    const updated = await $fetch<CdContact>(`/api/contacts/${id}`, { method: 'PATCH', body: payload })
    contacts.value = contacts.value.map((c) => {
      if (c.id !== id) return c
      // The contacts PATCH returns the o2m `activities` relation as bare id
      // strings (Directus serializes unselected aliases as keys), which would
      // clobber the fully-hydrated timeline we hold in state — every existing
      // touchpoint would lose its label/note/date until the next full refresh.
      // This endpoint never edits activities, so always keep the ones we have.
      return { ...c, ...updated, activities: (c as any).activities }
    })
    return updated
  }

  /** Upload (downscaled) a photo for a contact; updates local state on success. */
  async function uploadContactImage(id: string, file: File) {
    const blob = await downscaleImage(file)
    const fd = new FormData()
    fd.append('file', blob, file.name || 'photo.jpg')
    const r = await $fetch<{ image: string; imageUrl: string }>(`/api/contacts/${id}/image`, { method: 'POST', body: fd })
    contacts.value = contacts.value.map((c) => c.id === id ? { ...c, image: r.image, imageUrl: r.imageUrl } : c)
    return r
  }

  /** Clear a contact's photo (unsets the file id; the file itself is left in Directus). */
  async function removeContactImage(id: string) {
    await $fetch(`/api/contacts/${id}`, { method: 'PATCH', body: { image: null } })
    contacts.value = contacts.value.map((c) => c.id === id ? { ...c, image: null, imageUrl: null } : c)
  }

  async function hibernate(id: string) {
    return updateContact(id, { hibernated: true, hibernated_at: new Date().toISOString().slice(0, 10) } as any)
  }

  async function wake(id: string) {
    return updateContact(id, { hibernated: false } as any)
  }

  /** Pin / unpin a contact to the top of My Network. Mirrors hibernate/wake. */
  async function togglePin(id: string) {
    const c = contacts.value.find((x) => x.id === id)
    return updateContact(id, { pinned: !(c as any)?.pinned } as any)
  }

  async function logActivity(payload: Partial<CdActivity> & { contact: string }): Promise<CdActivity> {
    const activity = await $fetch<CdActivity>('/api/activities', { method: 'POST', body: payload })
    // Stage changes are tracked separately as `pipeline_stage_move` — don't double-count.
    if (payload.type && payload.type !== 'stage_change') analytics.activityLog(payload.type)
    // Merge the request payload under the server response so the optimistic
    // timeline row carries note/label/date even if the POST response omits a
    // field — the note used to only appear after a page refresh otherwise.
    const optimistic = { ...payload, ...activity } as CdActivity
    contacts.value = contacts.value.map((c) => {
      if (c.id !== payload.contact) return c
      return { ...c, activities: [optimistic, ...((c.activities as CdActivity[]) ?? [])] }
    })
    // Auto-advance New → Warming the first time real outreach is logged.
    if (payload.type && (OUTREACH_TYPES as readonly string[]).includes(payload.type)) {
      await usePipeline().maybeAutoWarm(payload.contact)
    }
    return activity
  }

  async function markResponded(contactId: string, activityId: string, note?: string) {
    const updated = await $fetch<CdActivity>(`/api/activities/${activityId}`, {
      method: 'PATCH', body: { is_response: true, response_note: note ?? 'Responded' },
    })
    contacts.value = contacts.value.map((c) => {
      if (c.id !== contactId) return c
      return { ...c, activities: (c.activities as CdActivity[]).map((a) => a.id === activityId ? { ...a, ...updated } : a) }
    })
    analytics.contactResponded()
  }

  // Undo an accidental "mark as responded" — clears the response flag/note.
  async function unmarkResponded(contactId: string, activityId: string) {
    const updated = await $fetch<CdActivity>(`/api/activities/${activityId}`, {
      method: 'PATCH', body: { is_response: false, response_note: null },
    })
    contacts.value = contacts.value.map((c) => {
      if (c.id !== contactId) return c
      return { ...c, activities: (c.activities as CdActivity[]).map((a) => a.id === activityId ? { ...a, ...updated } : a) }
    })
  }

  async function updateActivity(contactId: string, activityId: string, payload: Partial<CdActivity>) {
    const updated = await $fetch<CdActivity>(`/api/activities/${activityId}`, {
      method: 'PATCH', body: payload,
    })
    contacts.value = contacts.value.map((c) => {
      if (c.id !== contactId) return c
      return { ...c, activities: (c.activities as CdActivity[]).map((a) => a.id === activityId ? { ...a, ...updated } : a) }
    })
    return updated
  }

  async function deleteActivity(contactId: string, activityId: string) {
    await $fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
    contacts.value = contacts.value.map((c) => {
      if (c.id !== contactId) return c
      return { ...c, activities: (c.activities as CdActivity[]).filter((a) => a.id !== activityId) }
    })
  }

  function lastActivity(contact: CdContact): CdActivity | null {
    const acts = (contact.activities as CdActivity[]) ?? []
    if (!acts.length) return null
    return [...acts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
  }

  // Activity types that are book-keeping noise rather than a real touchpoint —
  // "Moved to Warming" (stage_change) reads as the last action but tells you
  // nothing about the relationship. The list peek prefers the newest *actionable*
  // touchpoint (outreach, response, an added/scanned event) over these.
  const NON_ACTIONABLE_TYPES = ['stage_change'] as const

  /** Newest meaningful touchpoint for the list peek — skips stage-change noise,
   *  falling back to the raw latest only if nothing else exists. */
  function lastMeaningfulActivity(contact: CdContact): CdActivity | null {
    const acts = (contact.activities as CdActivity[]) ?? []
    if (!acts.length) return null
    const sorted = [...acts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return sorted.find((a) => !(NON_ACTIONABLE_TYPES as readonly string[]).includes(a.type)) ?? sorted[0]
  }

  function daysSince(contact: CdContact): number | null {
    const la = lastActivity(contact)
    if (!la) return null
    return Math.floor((Date.now() - new Date(la.date).getTime()) / 86_400_000)
  }

  function followUpStatus(contact: CdContact): 'overdue' | 'due' | 'ok' | 'new' {
    const acts = (contact.activities as CdActivity[]) ?? []
    if (!acts.length) return 'new'
    const la = lastActivity(contact); if (!la) return 'new'
    const d = Math.floor((Date.now() - new Date(la.date).getTime()) / 86_400_000)
    if (d >= 10 && !la.is_response) return 'overdue'
    if (d >= 7) return 'due'
    return 'ok'
  }

  return {
    contacts, loading, error, fetchContacts, createContact, updateContact, uploadContactImage, removeContactImage,
    hibernate, wake, togglePin, logActivity, markResponded, unmarkResponded, updateActivity, deleteActivity, lastActivity, lastMeaningfulActivity, daysSince, followUpStatus,
  }
}
