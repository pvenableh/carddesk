/**
 * Graduate a cd_contact into the Earnest CRM (CardDesk-side bridge).
 *
 * Called from the Graduate flow when an Earnest-linked user converts a contact
 * to a Client or Partner. Mirrors Earnest's own /api/carddesk/[id]/promote, but
 * runs inside CardDesk against the shared Directus so it works with the
 * CardDesk session (no cross-subdomain auth):
 *   1. Create/lookup the org's `contacts` row (admin token; email-dedup).
 *   2. Stamp cd_contacts.promoted_contact (the bridge FK) + earnest_lead_id.
 *   3. Client only → open a `leads` row (partners get a contact, no sales lead).
 *   4. Return a deep-link into Earnest for the contact/lead.
 *
 * Body: { goal: 'client' | 'partner', reason?: string, note?: string }
 * Requires the caller to belong to an Earnest org (orgId from billing context);
 * CardDesk-only users never reach here (the UI shows a sign-up nudge instead).
 */
import { randomBytes } from 'node:crypto'
import { createItem, readItem, readItems, updateItem } from '@directus/sdk'
import { getDirectus, getUserDirectus } from '../../../utils/directus'
import { getValidToken } from '../../../utils/auth'
import { resolveBillingContext } from '../../../utils/ai-credits'

interface Body {
  goal: 'client' | 'partner'
  reason?: string
  note?: string
}

// cd rating → Earnest lead stage / score (only used for the client → lead path).
const STAGE_FROM_RATING: Record<string, string> = { hot: 'qualified', warm: 'contacted', nurture: 'new' }
const SCORE_FROM_RATING: Record<string, number> = { hot: 75, warm: 50, nurture: 25 }

export default defineEventHandler(async (event) => {
  const cdContactId = getRouterParam(event, 'id')
  if (!cdContactId) throw createError({ statusCode: 400, message: 'cd_contact id required' })

  const body = await readBody<Body>(event)
  if (body?.goal !== 'client' && body?.goal !== 'partner') {
    throw createError({ statusCode: 400, message: 'goal must be "client" or "partner"' })
  }

  const token = await getValidToken(event)
  const { userId, orgId } = await resolveBillingContext(event)
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'No Earnest organization linked to this account.' })
  }

  const userDx = getUserDirectus(token)
  const cd: any = await userDx.request(
    readItem('cd_contacts', cdContactId, {
      fields: ['id', 'name', 'first_name', 'last_name', 'email', 'phone', 'company', 'title', 'rating', 'promoted_contact', 'earnest_lead_id'],
    }),
  )
  if (!cd) throw createError({ statusCode: 404, message: 'Contact not found' })

  // Writes into Earnest's CRM tables go through the admin token — the Carddesk
  // User policy can't touch `contacts`/`leads`.
  const admin = getDirectus()

  // ── 1. Contact row (reuse if already bridged) ───────────────────────────
  let contactId: string = cd.promoted_contact
  if (!contactId) {
    const cdEmail = (cd.email || '').trim().toLowerCase()
    if (cdEmail) {
      const dupes: any[] = await admin.request(
        readItems('contacts', {
          fields: ['id'],
          filter: { _and: [{ email: { _eq: cdEmail } }, { organizations: { organizations_id: { _eq: orgId } } }] },
          sort: ['-date_updated'],
          limit: 1,
        }),
      )
      if (dupes[0]) contactId = dupes[0].id
    }

    if (!contactId) {
      const firstName = cd.first_name || (cd.name?.split(' ')[0] ?? 'Unknown')
      const lastName = cd.last_name || (cd.name?.split(' ').slice(1).join(' ') ?? '')
      const created: any = await admin.request(
        createItem('contacts', {
          first_name: firstName,
          last_name: lastName,
          email: cd.email || null,
          phone: cd.phone || null,
          company: cd.company || null,
          title: cd.title || null,
          source: 'carddesk',
          status: 'published',
          email_subscribed: true,
          unsubscribe_token: randomBytes(16).toString('hex'),
        }),
      )
      contactId = created.id
      await admin.request(createItem('contacts_organizations', { contacts_id: contactId, organizations_id: orgId }))
    }
  }

  // ── 2. Client → open a lead (partners stay a plain contact) ─────────────
  let leadId: string | null = cd.earnest_lead_id ?? null
  if (body.goal === 'client' && !leadId) {
    try {
      const lead: any = await admin.request(
        createItem('leads', {
          name: `${cd.first_name || cd.name || 'Contact'} ${cd.last_name || ''}`.trim() + ' (Card Desk)',
          stage: (cd.rating && STAGE_FROM_RATING[cd.rating]) || 'new',
          related_contact: contactId,
          assigned_to: userId,
          organization: orgId,
          lead_score: (cd.rating && SCORE_FROM_RATING[cd.rating]) || 25,
        }),
      )
      leadId = lead.id
    } catch (e: any) {
      console.error('[promote] failed to create lead', { cdContactId, error: e?.message })
    }
  }

  // ── 3. Stamp the bridge on the cd_contact (user-scoped, keeps attribution) ──
  try {
    await userDx.request(updateItem('cd_contacts', cdContactId, {
      promoted_contact: contactId,
      ...(leadId ? { earnest_lead_id: leadId } : {}),
    } as any))
  } catch (e: any) {
    console.error('[promote] failed to stamp cd_contact bridge', { cdContactId, error: e?.message })
  }

  const base = (useRuntimeConfig().public.earnestAppUrl as string).replace(/\/$/, '')
  const deepLink = leadId
    ? `${base}/apps/clients?view=leads&selected=${leadId}`
    : `${base}/apps/clients?view=contacts&selected=${contactId}`

  return { contactId, leadId, alreadyExisted: !!cd.promoted_contact, deepLink }
})
