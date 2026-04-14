import { readItems } from '@directus/sdk'

/**
 * Matches a CardDesk contact with an Earnest lead record.
 * Matches by email (primary), then by company + name (fallback).
 * Returns the Earnest lead record if found, otherwise null.
 */
export async function matchContactToLead(
  contact: { email?: string; name?: string; company?: string },
  directus: any,
): Promise<any | null> {
  try {
    // Primary match: by email
    if (contact.email) {
      const byEmail = await directus.request(
        readItems('leads' as any, {
          filter: { email: { _eq: contact.email } },
          limit: 1,
          fields: ['*'],
        }),
      ) as any[]
      if (byEmail?.length) return byEmail[0]
    }

    // Fallback match: by company + name
    if (contact.company && contact.name) {
      const byCompanyName = await directus.request(
        readItems('leads' as any, {
          filter: {
            _and: [
              { company: { _icontains: contact.company } },
              { name: { _icontains: contact.name } },
            ],
          },
          limit: 1,
          fields: ['*'],
        }),
      ) as any[]
      if (byCompanyName?.length) return byCompanyName[0]
    }

    return null
  } catch {
    // leads collection may not be accessible yet
    return null
  }
}
