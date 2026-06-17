// Alias module matching the canonical store. Some imports use `useAuthStore`,
// others `@/store/authStore` — both resolve to the same Zustand store.
export { useAuthStore, useAuth } from './authStore'
