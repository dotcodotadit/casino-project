import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeAccent = 'gold' | 'royal' | 'emerald' | 'crimson'

export const THEMES: { id: ThemeAccent; label: string; swatch: string }[] = [
  { id: 'gold', label: 'Gold', swatch: '#FFD700' },
  { id: 'royal', label: 'Royal', swatch: '#9b6cf0' },
  { id: 'emerald', label: 'Emerald', swatch: '#2fbf80' },
  { id: 'crimson', label: 'Crimson', swatch: '#e8455f' },
]

interface ThemeState {
  accent: ThemeAccent
  setAccent: (accent: ThemeAccent) => void
}

/** Apply the accent to <html data-theme>. 'gold' is the default (no attribute). */
function apply(accent: ThemeAccent) {
  const el = document.documentElement
  if (accent === 'gold') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', accent)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accent: 'gold',
      setAccent: (accent) => {
        apply(accent)
        set({ accent })
      },
    }),
    {
      name: 'casino-theme',
      onRehydrateStorage: () => (state) => {
        if (state) apply(state.accent)
      },
    },
  ),
)
