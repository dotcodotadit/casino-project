import { useEffect, useRef } from 'react'

/** Call `handler` when a pointerdown/Escape happens outside the returned ref. */
export function useClickOutside<T extends HTMLElement>(handler: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handler()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [handler])
  return ref
}
