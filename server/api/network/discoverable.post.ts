import { updateUser } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

/** Opt in/out of the network directory. Admin-token write (see the GET). */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const { value } = await readBody(event)
  const admin = getDirectus()
  await admin.request(updateUser(me, { discoverable: !!value } as any))
  return { discoverable: !!value }
})
