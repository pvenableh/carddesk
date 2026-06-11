/**
 * POST /api/tasks — create one task or several (own rows; `user` stamped server-side).
 * Body: a single TaskInput, or { tasks: TaskInput[] }.
 *   TaskInput: { title, contact?, plan?, channel?, note?, due_at?, sort?, source_session? }
 */
import { createItem, createItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

const CHANNELS = ['email', 'linkedin', 'call', 'meet', 'other']

function normalize(t: any, userId: string, i = 0) {
  return {
    user: userId,
    plan: t.plan ?? null,
    contact: t.contact ?? null,
    title: String(t.title).slice(0, 200),
    channel: CHANNELS.includes(t.channel) ? t.channel : null,
    note: typeof t.note === 'string' ? t.note : null,
    due_at: t.due_at ?? null,
    status: 'pending',
    sort: Number.isFinite(t.sort) ? t.sort : i,
    source_session: t.source_session ?? null,
  }
}

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const directus = getDirectus()
  const body = await readBody(event)

  try {
    if (Array.isArray(body?.tasks)) {
      const payload = body.tasks
        .filter((t: any) => t?.title && typeof t.title === 'string')
        .map((t: any, i: number) => normalize(t, userId, i))
      if (!payload.length) throw createError({ statusCode: 400, message: 'No valid tasks' })
      return await directus.request(createItems('cd_tasks', payload as any))
    }

    if (!body?.title || typeof body.title !== 'string')
      throw createError({ statusCode: 400, message: 'A task title is required' })
    return await directus.request(createItem('cd_tasks', normalize(body, userId) as any))
  } catch (err: any) {
    if (err?.statusCode) throw err
    console.error('[POST /api/tasks]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to create task' })
  }
})
