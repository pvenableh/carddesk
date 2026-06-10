import { readItems } from '@directus/sdk'
import { getUserDirectus } from '../../utils/directus'
import { getValidToken } from '../../utils/auth'
import { SOCIAL_KEYS } from '~/types/socials'
import { buildVCardBatch, type VCardPhoto } from '~/types/vcard'

/**
 * Batch vCard (.vcf) export of the caller's contacts. Reuses the same
 * cd_contacts query as GET /api/contacts (ownership enforced via the user
 * token — never exports another user's contacts). Body:
 *   { ids?: string[]; includePhotos?: boolean }
 * `ids` narrows to a selected subset; omitted = all of the user's contacts.
 * `includePhotos` embeds each contact photo as a base64 PHOTO in the vCard.
 */
export default defineEventHandler(async (event) => {
  const token = await getValidToken(event)
  const directus = getUserDirectus(token)
  const body = await readBody<{ ids?: string[]; includePhotos?: boolean }>(event).catch(() => ({}))
  const ids = Array.isArray(body?.ids) ? body!.ids!.filter(Boolean) : null

  try {
    const filter: any = { user_created: { _eq: '$CURRENT_USER' } }
    if (ids?.length) filter.id = { _in: ids }

    const rows = (await directus.request(
      readItems('cd_contacts', {
        fields: [
          'id', 'name', 'first_name', 'last_name', 'title', 'company',
          'email', 'phone', ...SOCIAL_KEYS, 'notes', 'image',
        ],
        filter,
        sort: ['name'],
        limit: 1000,
      }),
    )) as any[]

    if (!rows.length) throw createError({ statusCode: 404, message: 'No contacts to export' })

    let photos: Record<string, VCardPhoto | null> | undefined
    if (body?.includePhotos) {
      photos = {}
      const config = useRuntimeConfig()
      const base = String(config.public.directusUrl).replace(/\/$/, '')
      // Fetch photos sequentially-ish; failures are skipped so one bad asset
      // never breaks the whole export.
      await Promise.all(
        rows
          .filter((c) => c.image)
          .map(async (c) => {
            try {
              const res = await fetch(`${base}/assets/${c.image}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (!res.ok) return
              const mime = res.headers.get('content-type') ?? 'image/jpeg'
              const type = mime.includes('png') ? 'PNG' : mime.includes('gif') ? 'GIF' : 'JPEG'
              const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
              photos![c.id] = { base64, type }
            } catch {
              /* skip this photo */
            }
          }),
      )
    }

    const vcf = buildVCardBatch(rows, photos)
    setHeader(event, 'Content-Type', 'text/vcard; charset=utf-8')
    setHeader(event, 'Content-Disposition', 'attachment; filename="carddesk-contacts.vcf"')
    return vcf
  } catch (err: any) {
    if (err?.statusCode) throw err
    console.error('[POST /api/contacts/export] error:', err?.errors ?? err?.message ?? err)
    const msg = err?.errors?.[0]?.message ?? err?.message ?? 'Failed to export contacts'
    throw createError({ statusCode: err?.status ?? 500, message: msg })
  }
})
