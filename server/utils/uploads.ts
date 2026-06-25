import { readFolders, createFolder } from '@directus/sdk'
import { getDirectus } from './directus'

/**
 * Centralised file uploads for CardDesk.
 *
 * The Earnest Directus is shared (agency + clients), so every CardDesk upload is
 * filed under one parent folder, split by purpose, instead of dumping into the
 * library root. Folders are resolved by name and created lazily on first use, so
 * the structure self-heals if a folder is renamed/removed in the Directus UI.
 */
const ROOT_FOLDER = 'CardDesk'

export const UPLOAD_FOLDERS = {
  card: 'Card Images',
  cover: 'Card Covers',
  logo: 'Card Logos',
  avatar: 'Profile Avatars',
  contact: 'Contact Photos',
} as const
export type UploadFolderKey = keyof typeof UPLOAD_FOLDERS

// Resolved folder ids, cached for the process lifetime (`parent/name` → id).
const folderIdCache = new Map<string, string>()

async function ensureFolder(name: string, parent: string | null): Promise<string> {
  const cacheKey = `${parent ?? 'root'}/${name}`
  const cached = folderIdCache.get(cacheKey)
  if (cached) return cached

  const admin = getDirectus()
  const found = (await admin.request(
    readFolders({
      filter: { name: { _eq: name }, parent: parent ? { _eq: parent } : { _null: true } } as any,
      fields: ['id'],
      limit: 1,
    }),
  )) as any[]
  let id = found?.[0]?.id
  if (!id) {
    const created = (await admin.request(createFolder({ name, parent: parent ?? null } as any))) as any
    id = created.id
  }
  folderIdCache.set(cacheKey, id)
  return id
}

/** Resolve (creating if needed) the Directus folder id for a CardDesk upload type. */
export async function getUploadFolderId(key: UploadFolderKey): Promise<string | null> {
  try {
    const rootId = await ensureFolder(ROOT_FOLDER, null)
    return await ensureFolder(UPLOAD_FOLDERS[key], rootId)
  } catch (err: any) {
    // Never fail an upload over folder bookkeeping — fall back to the root.
    console.error('[uploads] folder resolve failed:', err?.errors ?? err?.message ?? err)
    return null
  }
}

/**
 * Upload a file to Directus, filed into the CardDesk folder for `key`. Uses the
 * static (admin) token. Returns the new Directus file id.
 *
 * This is the single choke-point for every CardDesk upload, so storage stays
 * organised no matter which feature uploaded the file.
 */
export async function uploadCardDeskFile(
  file: { data: Buffer | Uint8Array; filename: string; type?: string },
  key: UploadFolderKey,
): Promise<string> {
  const config = useRuntimeConfig()
  const folderId = await getUploadFolderId(key)

  const fd = new FormData()
  // Directus only honours `folder` when it precedes the file part in the form.
  if (folderId) fd.append('folder', folderId)
  fd.append('file', new Blob([file.data], { type: file.type || 'application/octet-stream' }), file.filename)

  const directusUrl = String(config.public.directusUrl).replace(/\/$/, '')
  const res = await fetch(`${directusUrl}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.directusStaticToken}` },
    body: fd,
  })
  if (!res.ok) {
    console.error('[uploads] upload failed', res.status, await res.text().catch(() => ''))
    throw createError({ statusCode: 502, message: 'Image upload failed' })
  }
  const json = (await res.json()) as any
  const id = json?.data?.id
  if (!id) throw createError({ statusCode: 502, message: 'Image upload failed' })
  return id
}

/**
 * Shared multipart guard: pull the `file` part out of a request and validate
 * size. Returns the part ready to hand to uploadCardDeskFile.
 */
export async function readUploadFile(event: any, maxBytes = 5 * 1024 * 1024) {
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p: any) => p.name === 'file' && p.filename)
  if (!file) throw createError({ statusCode: 400, message: 'No file provided' })
  if (file.data.length > maxBytes) throw createError({ statusCode: 413, message: 'Image must be under 5MB' })
  return file
}
