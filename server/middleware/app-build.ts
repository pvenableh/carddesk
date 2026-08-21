/**
 * Stamp every API response with the running build id.
 *
 * This is the server half of the version handshake: the client wraps `fetch`
 * (app/plugins/app-update.client.ts) and compares this header against its own
 * build id on every same-origin call, so a stale client learns it is stale on
 * its very next request. That closes two gaps a poll leaves open:
 *   - an idle-but-visible tab that never navigates and never polls in time; and
 *   - client/API skew during the seconds a rollout is only half-live.
 *
 * Scoped to /api/* — everything else is either immutable-hashed (_nuxt) or a
 * document navigation, neither of which needs the hint.
 */
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/')) return
  const buildId = useRuntimeConfig(event).app?.buildId
  if (buildId) setResponseHeader(event, 'x-app-build', buildId)
})
