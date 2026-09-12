import { useEffect, useState } from 'react'

export interface WindowDimensions {
  width: number
  height: number
}

/**
 * Track the live window dimensions via resize events. Used to degrade
 * shortcut-hint density on small windows (fewer rows / hidden hints) so
 * nothing collides with the hover toolbar.
 */
export function useWindowSize(): WindowDimensions {
  const [size, setSize] = useState<WindowDimensions>({
    width: window.innerWidth,
    height: window.innerHeight
  })

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return size
}
