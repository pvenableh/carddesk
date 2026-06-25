/**
 * Quick-action rail — the app-like shortcut row at the top of the Vibe screen.
 *
 * The order is a deliberate product choice (Event mode first, My card last),
 * NOT adaptive — what reacts to the user's data is the *context*: badge counts
 * (overdue follow-ups, cold contacts) and the Event mode active/"N met" state.
 * Adaptive re-ordering of the middle slots is a planned v2 (see the fluidity
 * pass notes) — this composable is the single place it would slot in.
 *
 * `cost` is kept on every action as data but is intentionally NOT rendered for
 * now (the labels read as a turn-off). A future `showCost` setting can surface
 * it without touching the rail markup.
 */
export interface QuickAction {
  id: string
  label: string
  /** Lucide icon name (`lucide:*`). Omitted when `mark` is set. */
  icon?: string
  /** Render a brand mark instead of an icon (e.g. the CardDesk card mark). */
  mark?: 'card'
  /** Per-tile accent color (a CSS color / var) so the rail reads as distinct,
   *  color-coded shortcuts rather than a row of identical grey tiles. Falls back
   *  to the theme accent. In monochrome themes the color vars collapse to grey,
   *  so this still respects the appearance system. */
  tint?: string
  /** Count badge; falsy/undefined renders nothing. */
  badge?: number
  /** Highlighted "on" state — e.g. Event mode while it's running. */
  active?: boolean
  /** Credits this action spends. Stored but hidden until a showCost setting opts in. */
  cost?: number
  run: () => void
}

export function useQuickActions() {
  const { contacts, followUpStatus } = useContacts()
  const { nav } = useNavigation()
  const { show: openShareSheet } = useShareSheet()
  const { show: openPresent } = usePresentCard()
  const eventMode = useEventMode()

  const overdueCount = computed(
    () => contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue').length,
  )
  const coldCount = computed(
    () => contacts.value.filter((c) => c.rating === 'cold' && !c.hibernated).length,
  )

  const actions = computed<QuickAction[]>(() => [
    {
      id: 'scan',
      label: 'Scan a card',
      icon: 'lucide:scan',
      tint: 'var(--cd-green)',
      run: () => nav('add'),
    },
    {
      id: 'event',
      label: 'Event mode',
      icon: 'lucide:radio',
      tint: 'var(--cd-blue)',
      active: eventMode.active.value,
      badge: eventMode.active.value ? eventMode.count.value : undefined,
      run: () => eventMode.openPanel(),
    },
    {
      id: 'followup',
      label: 'Follow up',
      icon: 'lucide:clock',
      tint: 'var(--cd-orange)',
      badge: overdueCount.value || undefined,
      run: () => nav('contacts'),
    },
    {
      id: 'reconnect',
      label: 'Reconnect',
      icon: 'lucide:heart-handshake',
      tint: 'var(--cd-purple)',
      badge: coldCount.value || undefined,
      cost: 1,
      run: () => nav('cold'),
    },
    {
      id: 'analyze',
      label: 'Analyze',
      icon: 'lucide:network',
      tint: 'var(--cd-gold)',
      cost: 2,
      run: () => nav('home'),
    },
    {
      id: 'invite',
      label: 'Invite',
      icon: 'lucide:user-plus',
      tint: 'var(--cd-blue)',
      run: () => openShareSheet('invite'),
    },
    {
      id: 'mycard',
      label: 'My card',
      mark: 'card',
      tint: 'var(--cd-green)',
      run: () => openPresent(),
    },
  ])

  return { actions }
}
