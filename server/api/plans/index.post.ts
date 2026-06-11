/**
 * POST /api/plans — create a plan, optionally with its tasks in one shot.
 * Body: { contact?, title, status?, source_session?, tasks?: TaskInput[] }
 *   TaskInput: { title, channel?, note?, due_at?, sort? }
 *
 * Owner (`user`) is stamped server-side from the session; the client never
 * supplies it. Tasks inherit the plan's contact + source_session.
 */
import { createItem, createItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const directus = getDirectus()
  const body = await readBody(event)

  if (!body?.title || typeof body.title !== 'string')
    throw createError({ statusCode: 400, message: 'A plan title is required' })

  const contact = body.contact ?? null
  const source_session = body.source_session ?? null

  try {
    const plan = (await directus.request(
      createItem('cd_plans', {
        user: userId,
        contact,
        title: body.title.slice(0, 160),
        status: ['active', 'done', 'archived'].includes(body.status) ? body.status : 'active',
        source_session,
      } as any),
    )) as any

    let tasks: any[] = []
    if (Array.isArray(body.tasks) && body.tasks.length) {
      const payload = body.tasks
        .filter((t: any) => t?.title && typeof t.title === 'string')
        .map((t: any, i: number) => ({
          user: userId,
          plan: plan.id,
          contact,
          title: String(t.title).slice(0, 200),
          channel: ['email', 'linkedin', 'call', 'meet', 'other'].includes(t.channel) ? t.channel : null,
          note: typeof t.note === 'string' ? t.note : null,
          due_at: t.due_at ?? null,
          status: 'pending',
          sort: Number.isFinite(t.sort) ? t.sort : i,
          source_session,
        }))
      if (payload.length) tasks = (await directus.request(createItems('cd_tasks', payload as any))) as any[]
    }

    return { ...plan, tasks }
  } catch (err: any) {
    console.error('[POST /api/plans]', err?.errors ?? err?.message ?? err)
    throw createError({
      statusCode: err?.status ?? 500,
      message: err?.errors?.[0]?.message ?? 'Failed to create plan',
    })
  }
})
