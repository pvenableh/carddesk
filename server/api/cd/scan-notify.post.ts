// POST /api/cd/scan-notify — fire a push to every OTHER device the user has
// subscribed when they scan a new card. The originating device skips the
// notification (boring to see "you scanned a card" on the device that just
// did it).
//
// Called from AddContactScreen.vue after the scan-created contact is saved.

import { cdPushToUser } from '../../utils/web-push'
import { getCurrentUserId } from '../../utils/auth'

interface ScanNotifyBody {
  contact_id?: string
  contact_name?: string
  contact_company?: string | null
}

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)

  const body = (await readBody<ScanNotifyBody>(event)) || {}
  const name = body.contact_name?.trim() || 'a new contact'
  const company = body.contact_company?.trim() || ''
  const tail = company ? ` from ${company}` : ''

  const hdrs = getRequestHeaders(event)
  const currentUA = hdrs['user-agent'] || ''

  // Fire-and-forget — don't block the scan UX on push delivery.
  void cdPushToUser(
    userId,
    {
      title: 'Card scanned on another device',
      body: `${name}${tail} is now in your CardDesk.`,
      url: body.contact_id ? `/?contact=${body.contact_id}` : '/',
      tag: 'cd-scan',
      data: { kind: 'scan', contact_id: body.contact_id || null },
    },
    { excludeUserAgentSubstring: currentUA },
  )

  return { ok: true }
})
