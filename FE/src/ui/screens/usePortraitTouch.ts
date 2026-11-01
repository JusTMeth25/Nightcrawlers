import { useEffect, useState } from 'react'

const PORTRAIT_TOUCH = '(orientation: portrait) and (pointer: coarse)'

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PORTRAIT_TOUCH) : null
}

/** True on a touch screen held vertically. */
export function usePortraitTouch(): boolean {
  const [matches, setMatches] = useState(() => media()?.matches ?? false)

  useEffect(() => {
    const query = media()
    if (!query) return
    const onChange = () => setMatches(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return matches
}
