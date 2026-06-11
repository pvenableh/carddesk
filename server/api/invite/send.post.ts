import { randomBytes } from 'node:crypto'
import { readItems, readUsers, createItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'
import { inviteEmail } from '../../utils/emails/invite'
import { sendEmail } from '../../utils/email-send'

/**
 * POST /api/invite/send — send a CONTACT-TARGETED invitation email.
 * Body: { contactId, note? }
 *
 * Mints (or reuses) an invite tied to this specific contact, so when they join
 * via the link, redeem can deterministically bridge them back to the source
 * contact (and credit the referral) instead of guessing by email. The email is
 * best-effort; the personalized URL is always returned so the UI can fall back
 * to copy/share if SendGrid is unavailable.
 *
 * Admin-token + explicit owner scoping (like the credit/XP paths): we never
 * trust the client for ownership — the contact read is filtered on user_created.
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const { contactId, note } = await readBody(event)
  if (!contactId || typeof contactId !== 'string')
    throw createError({ statusCode: 400, message: 'contactId is required' })

  const config = useRuntimeConfig()
  const admin = getDirectus()

  // Ownership-scoped contact read.
  const contacts = (await admin.request(
    readItems('cd_contacts' as any, {
      filter: { _and: [{ id: { _eq: contactId } }, { user_created: { _eq: me } }] } as any,
      fields: ['id', 'name', 'first_name', 'email', 'linked_user'],
      limit: 1,
    }),
  )) as any[]
  const contact = contacts?.[0]
  if (!contact) throw createError({ statusCode: 404, message: 'Contact not found' })
  if (!contact.email) throw createError({ statusCode: 400, message: 'This contact has no email to invite.' })
  if (contact.linked_user)
    throw createError({ statusCode: 409, message: `${contact.name || 'They'} is already on CardDesk.` })

  // Reuse an existing, still-open invite for this contact; otherwise mint one.
  const existing = (await admin.request(
    readItems('cd_invites' as any, {
      filter: {
        _and: [{ inviter: { _eq: me } }, { contact: { _eq: contactId } }, { accepted_by: { _null: true } }],
      } as any,
      fields: ['id', 'code'],
      sort: ['-date_created'],
      limit: 1,
    }),
  )) as any[]

  let code: string = existing?.[0]?.code
  if (!code) {
    code = randomBytes(6).toString('base64url')
    await admin.request(
      createItem('cd_invites' as any, {
        inviter: me,
        code,
        contact: contactId,
        target_email: String(contact.email).toLowerCase(),
      } as any),
    )
  }

  const url = `${config.public.appUrl}/i/${code}`

  // Inviter display name for the email.
  const meUsers = (await admin.request(
    readUsers({ filter: { id: { _eq: me } } as any, fields: ['first_name', 'last_name'], limit: 1 }),
  )) as any[]
  const inviterName =
    [meUsers?.[0]?.first_name, meUsers?.[0]?.last_name].filter(Boolean).join(' ') || 'A CardDesk user'

  // Best-effort send — never throws (see sendEmail).
  const personalNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : null
  const { subject, html, text } = await inviteEmail({
    inviterName,
    firstName: contact.first_name || null,
    personalNote,
    inviteUrl: url,
  })
  const result = await sendEmail({ to: contact.email, subject, html, text, emailName: 'invite' })

  return { sent: result.sent, reason: result.reason ?? null, url, code, email: contact.email }
})
