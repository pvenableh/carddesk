export type ToastType = 'error' | 'success' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

let _id = 0

/**
 * Lightweight glass-styled toast queue. Rendered globally by <GlassToast>.
 * Use for transient feedback (scan failures, save confirmations, etc.).
 */
export function useToast() {
  const toasts = useState<ToastItem[]>('cd_toasts', () => [])

  function show(message: string, type: ToastType = 'info', ms = 4000): number {
    const id = ++_id
    toasts.value = [...toasts.value, { id, type, message }]
    if (ms > 0 && import.meta.client) setTimeout(() => dismiss(id), ms)
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts,
    toast: show,
    success: (m: string) => show(m, 'success'),
    error: (m: string) => show(m, 'error', 6000),
    info: (m: string) => show(m, 'info'),
    dismiss,
  }
}
