/**
 * POST /api/feedback — record user feedback on AI output.
 * Body: { contact?, session?, rating ('up'|'down'), source?, outcome?, note? }
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
    session: body.session ?? null,
    rating: body.rating ?? null,
    source: body.source ?? null,
    outcome: body.outcome ?? null,
    note: body.note ?? null,
  }

  try {
    return await directus.request(createItem('cd_feedback', payload as any))
  } catch (err: any) {
    console.error('[POST /api/feedback]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to save feedback' })
  }
})
