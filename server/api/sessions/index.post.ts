/**
 * POST /api/sessions — save an AI session/conversation.
 * Created with the user's token so user_created is auto-attributed.
 * Body: { type, contact?, title, summary?, messages[], is_pinned? }
 */
import { createItem } from '@directus/sdk'
import { getUserDirectus } from '../../utils/directus'
import { getValidToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event)
  const body = await readBody(event)
  const directus = getUserDirectus(token)

  const payload = {
    contact: body.contact ?? null,
    type: body.type ?? 'note',
    title: body.title ?? 'Saved session',
    summary: body.summary ?? null,
    messages: Array.isArray(body.messages) ? body.messages : [],
    is_pinned: !!body.is_pinned,
  }

  try {
    return await directus.request(createItem('cd_sessions', payload as any))
  } catch (err: any) {
    console.error('[POST /api/sessions]', err?.errors ?? err?.message ?? err)
    throw createError({
      statusCode: err?.status ?? 500,
      message: err?.errors?.[0]?.message ?? 'Failed to save session',
    })
  }
})
