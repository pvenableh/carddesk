import { readItems, createItem, updateUser } from '@directus/sdk'
import { getDirectus } from './directus'

/**
 * Grant CardDesk access to an EXISTING Directus user — one that already lives on
 * the shared instance because they used Earnest (or were seeded there) — without
 * disturbing any access they already have.
 *
 * Directus gives each user exactly ONE role, so we must never overwrite a
 * non-null role: doing so would strip their Earnest access. Two cases:
 *   - No role at all   → assign the CardDesk role outright (nothing to lose; the
 *                        role carries its policies).
 *   - Has another role → copy the CardDesk role's POLICIES onto the user via
 *                        directus_access (additive M2M; their role stays put).
 *
 * Idempotent. Callers treat a throw as non-fatal — the invite/connection still
 * completes through the admin token even if the grant is incomplete.
 */
export async function ensureCardDeskAccess(userId: string, currentRole: string | null): Promise<void> {
  const config = useRuntimeConfig()
  const cardDeskRole = config.public.directusRoleUser
  if (!cardDeskRole) return
  if (currentRole === cardDeskRole) return // already a CardDesk user

  const admin = getDirectus()

  if (!currentRole) {
    // Nothing to preserve — give them the CardDesk role (and its policies).
    await admin.request(updateUser(userId, { role: cardDeskRole } as any))
    return
  }

  // Cross-app user (keeps their existing role): replicate the CardDesk role's
  // policy grants directly onto the user so they gain CardDesk permissions.
  const rolePolicies = (await admin.request(
    readItems('directus_access' as any, {
      filter: { role: { _eq: cardDeskRole } } as any,
      fields: ['policy'],
      limit: 100,
    }),
  )) as any[]
  const policyIds = (rolePolicies ?? []).map((r) => r.policy).filter(Boolean)
  if (!policyIds.length) return

  const already = (await admin.request(
    readItems('directus_access' as any, {
      filter: { _and: [{ user: { _eq: userId } }, { policy: { _in: policyIds } }] } as any,
      fields: ['policy'],
      limit: 100,
    }),
  )) as any[]
  const have = new Set((already ?? []).map((r) => r.policy))

  for (const policy of policyIds) {
    if (have.has(policy)) continue
    await admin.request(createItem('directus_access' as any, { user: userId, policy } as any))
  }
}
