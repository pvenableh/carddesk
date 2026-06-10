import { updateMe } from '@directus/sdk'
import { getUserClient } from '../../utils/auth'
import { assetUrl } from '../../utils/cards'
import { uploadCardDeskFile, readUploadFile } from '../../utils/uploads'

/**
 * Upload the user's Earnest (Directus) profile avatar. Forwards the file to
 * Directus (filed under the CardDesk "Profile Avatars" folder), then sets it as
 * the avatar on the user's own directus_users row (updateMe, user token) — so
 * this genuinely updates their Earnest account photo, shared across Earnest.
 */
export default defineEventHandler(async (event) => {
  const { directus } = await getUserClient(event)

  const file = await readUploadFile(event)
  const fileId = await uploadCardDeskFile(file, 'avatar')

  try {
    await directus.request(updateMe({ avatar: fileId } as any))
  } catch (err: any) {
    console.error('[profile/avatar] updateMe failed:', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Could not update your Earnest avatar' })
  }

  return { avatar: fileId, avatarUrl: assetUrl(fileId) }
})
