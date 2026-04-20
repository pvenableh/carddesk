import { readItems } from '@directus/sdk'

/**
 * Matches a CardDesk contact with an Earnest lead record.
 *
 * Earnest's `leads` collection has no email/name/company fields — a lead is
 * always linked to a row in `contacts` via `related_contact`. So we two-step:
 *   1. Find the Earnest `contacts` row by email (fallback: company + name).
 *   2. Read the `leads` row whose `related_contact` points at it.
 */
export async function matchContactToLead(
  contact: { email?: string; name?: string; first_name?: string; last_name?: string; company?: string },
  directus: any,
): Promise<any | null> {
  try {
    let earnestContactId: string | number | null = null

    if (contact.email) {
      const byEmail = await directus.request(
        readItems('contacts' as any, {
          filter: { email: { _eq: contact.email } },
          limit: 1,
          fields: ['id'],
        }),
      ) as any[]
      if (byEmail?.length) earnestContactId = byEmail[0].id
    }

    if (!earnestContactId && contact.company) {
      const first = contact.first_name?.trim()
      const last = contact.last_name?.trim()
      const nameFilters: any[] = []
      if (first) nameFilters.push({ first_name: { _icontains: first } })
      if (last) nameFilters.push({ last_name: { _icontains: last } })
      if (!nameFilters.length && contact.name) {
        const [f, ...rest] = contact.name.trim().split(/\s+/)
        if (f) nameFilters.push({ first_name: { _icontains: f } })
        if (rest.length) nameFilters.push({ last_name: { _icontains: rest.join(' ') } })
      }
      if (nameFilters.length) {
        const byCompanyName = await directus.request(
          readItems('contacts' as any, {
            filter: { _and: [{ company: { _icontains: contact.company } }, ...nameFilters] },
            limit: 1,
            fields: ['id'],
          }),
        ) as any[]
        if (byCompanyName?.length) earnestContactId = byCompanyName[0].id
      }
    }

    if (!earnestContactId) return null

    const leads = await directus.request(
      readItems('leads' as any, {
        filter: { related_contact: { _eq: earnestContactId } },
        limit: 1,
        fields: ['*'],
      }),
    ) as any[]

    return leads?.[0] ?? null
  } catch {
    return null
  }
}
