import type { CdContact, CdActivity } from '~/types/directus'

export function useContacts() {
  const contacts = useState<CdContact[]>('cd_contacts', () => [])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchContacts() {
    loading.value = true; error.value = null
    try { contacts.value = await $fetch<CdContact[]>('/api/contacts') }
    catch (err: any) { error.value = err?.data?.message ?? 'Failed to load contacts' }
    finally { loading.value = false }
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
    } catch { /* activity logging is best-effort */ }
    contacts.value = [{ ...contact, activities: activity ? [activity] : [] }, ...contacts.value]
    return contact
  }

  async function updateContact(id: string, payload: Partial<CdContact>) {
    const updated = await $fetch<CdContact>(`/api/contacts/${id}`, { method: 'PATCH', body: payload })
    contacts.value = contacts.value.map((c) => c.id === id ? { ...c, ...updated } : c)
    return updated
  }

  async function hibernate(id: string) {
    return updateContact(id, { hibernated: true, hibernated_at: new Date().toISOString().slice(0, 10) } as any)
  }

  async function wake(id: string) {
    return updateContact(id, { hibernated: false } as any)
  }

  async function logActivity(payload: Partial<CdActivity> & { contact: string }): Promise<CdActivity> {
    const activity = await $fetch<CdActivity>('/api/activities', { method: 'POST', body: payload })
    contacts.value = contacts.value.map((c) => {
      if (c.id !== payload.contact) return c
      return { ...c, activities: [activity, ...((c.activities as CdActivity[]) ?? [])] }
    })
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
  }

  function lastActivity(contact: CdContact): CdActivity | null {
    const acts = (contact.activities as CdActivity[]) ?? []
    if (!acts.length) return null
    return [...acts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
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
    contacts, loading, error, fetchContacts, createContact, updateContact,
    hibernate, wake, logActivity, markResponded, lastActivity, daysSince, followUpStatus,
  }
}
