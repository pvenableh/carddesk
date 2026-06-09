import type { ConnectionStatus } from '~/types/directus'

export interface NetworkConnection {
  id: string
  status: ConnectionStatus
  direction: 'incoming' | 'outgoing' | null
  since: string
  user: { id: string; name: string; title: string | null; avatarUrl: string | null }
}

/**
 * Client-side state + actions for the user↔user network. Backed by
 * /api/connections (server enforces ownership). Shared via useState so the
 * Network screen, badges, and any future orbit view stay in sync.
 */
export function useConnections() {
  const connections = useState<NetworkConnection[]>('cd-connections', () => [])
  const loaded = useState('cd-connections-loaded', () => false)
  const loading = useState('cd-connections-loading', () => false)

  async function load(force = false) {
    if (loading.value || (loaded.value && !force)) return
    loading.value = true
    try {
      const { connections: list } = await $fetch<{ connections: NetworkConnection[] }>('/api/connections')
      connections.value = list ?? []
      loaded.value = true
    } catch (err) {
      console.error('[useConnections] load failed:', err)
    } finally {
      loading.value = false
    }
  }

  const accepted = computed(() => connections.value.filter((c) => c.status === 'accepted'))
  const incoming = computed(() => connections.value.filter((c) => c.status === 'pending' && c.direction === 'incoming'))
  const outgoing = computed(() => connections.value.filter((c) => c.status === 'pending' && c.direction === 'outgoing'))

  /** Send a connection request to a user id. Returns true if a new/accepted edge resulted. */
  async function connect(userId: string): Promise<boolean> {
    const res = await $fetch<{ connection: any; mutual?: boolean; existing?: boolean }>('/api/connections', {
      method: 'POST',
      body: { userId },
    })
    await load(true)
    return !res.existing || !!res.mutual
  }

  async function respond(id: string, action: 'accept' | 'decline' | 'block' | 'remove') {
    await $fetch(`/api/connections/${id}`, { method: 'PATCH', body: { action } })
    if (action === 'remove' || action === 'decline') {
      connections.value = connections.value.filter((c) => c.id !== id)
    } else {
      await load(true)
    }
  }

  return { connections, accepted, incoming, outgoing, loading, loaded, load, connect, respond }
}
