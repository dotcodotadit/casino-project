import { create } from 'zustand'

export type NotifVariant = 'success' | 'error' | 'info' | 'win'

export interface NotificationItem {
  id: number
  title: string
  message?: string
  variant: NotifVariant
  createdAt: number
  read: boolean
}
export interface ToastItem {
  id: number
  title: string
  message?: string
  variant: NotifVariant
}

interface NotificationsState {
  items: NotificationItem[] // history (bell)
  toasts: ToastItem[] // transient
  unread: number
  notify: (n: { title: string; message?: string; variant?: NotifVariant; toast?: boolean }) => void
  dismissToast: (id: number) => void
  markAllRead: () => void
  clear: () => void
}

let counter = 0

export const useNotifications = create<NotificationsState>((set, get) => ({
  items: [],
  toasts: [],
  unread: 0,

  notify: ({ title, message, variant = 'info', toast = true }) => {
    const id = ++counter
    const item: NotificationItem = { id, title, message, variant, createdAt: Date.now(), read: false }
    set((s) => ({
      items: [item, ...s.items].slice(0, 50),
      unread: s.unread + 1,
      toasts: toast ? [...s.toasts, { id, title, message, variant }] : s.toasts,
    }))
    if (toast) {
      setTimeout(() => get().dismissToast(id), 4000)
    }
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })), unread: 0 })),
  clear: () => set({ items: [], unread: 0 }),
}))

/** Convenience for non-React modules (services, socket). */
export const notify = (n: Parameters<NotificationsState['notify']>[0]) => useNotifications.getState().notify(n)
