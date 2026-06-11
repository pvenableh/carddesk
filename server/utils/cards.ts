import { readItems, createItem, readUsers } from '@directus/sdk'
import { getDirectus } from './directus'

import { SOCIAL_KEYS } from '~/types/socials'

export const CARD_FIELDS = [
  'id', 'user', 'display_name', 'title', 'company', 'email',
  'phone', 'website', ...SOCIAL_KEYS, 'headline', 'office_address', 'image', 'broadcast_activity',
]

/**
 * One cd_cards row per user, created lazily and seeded from the user's Directus
 * profile (name/title) + primary org (company) on first access.
 *
 * Pass `db` — a Directus client bound to the acting user's token (see
 * getUserClient) — so the cd_cards read/create is attributed to the user in the
 * Directus activity log; the user role is scoped to its own `user` row. The
 * profile/org seed read always uses the static token because the user role
 * can't read directus_users. Falls back to the static token when `db` is
 * omitted (system callers).
 */
export async function getOrCreateCard(userId: string, db?: any): Promise<any> {
  const admin = getDirectus()
  const client = db ?? admin
  const rows = (await client.request(
    readItems('cd_cards' as any, { filter: { user: { _eq: userId } } as any, fields: CARD_FIELDS as any, limit: 1 }),
  )) as any[]
  if (rows?.length) return rows[0]

  // Seed from the user's profile + first org (static token — user role can't read users).
  const users = (await admin.request(
    readUsers({
      filter: { id: { _eq: userId } } as any,
      fields: ['first_name', 'last_name', 'title', 'email', { organizations: [{ organizations_id: ['name'] }] }] as any,
      limit: 1,
    }),
  )) as any[]
  const u = users?.[0] ?? {}
  const created = (await client.request(
    createItem('cd_cards' as any, {
      user: userId,
      display_name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null,
      title: u.title ?? null,
      company: u.organizations?.[0]?.organizations_id?.name ?? null,
      email: u.email ?? null,
      broadcast_activity: true,
    } as any),
  )) as any
  return created
}

/** Absolute asset URL for a Directus file id (or null). */
export function assetUrl(fileId: string | null | undefined): string | null {
  if (!fileId) return null
  const config = useRuntimeConfig()
  return `${String(config.public.directusUrl).replace(/\/$/, '')}/assets/${fileId}`
}

/**
 * Resolve avatar image URLs for a set of users. Prefers the user's cd_cards
 * image (the photo they set on their card), falling back to their Directus
 * profile avatar. Returns a map of userId → asset URL (or null).
 */
export async function getAvatarUrls(userIds: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  if (!userIds.length) return out
  const admin = getDirectus()

  const cards = (await admin.request(
    readItems('cd_cards' as any, { filter: { user: { _in: userIds } } as any, fields: ['user', 'image'], limit: 1000 }),
  )) as any[]
  const cardImg: Record<string, string> = {}
  for (const c of cards) {
    const u = typeof c.user === 'object' ? c.user?.id : c.user
    if (c.image) cardImg[u] = c.image
  }

  const users = (await admin.request(
    readUsers({ filter: { id: { _in: userIds } } as any, fields: ['id', 'avatar'], limit: 1000 }),
  )) as any[]
  const profileAvatar: Record<string, string | null> = {}
  for (const u of users) profileAvatar[u.id] = u.avatar ?? null

  for (const id of userIds) out[id] = assetUrl(cardImg[id] ?? profileAvatar[id] ?? null)
  return out
}
