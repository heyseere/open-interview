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
    // Drag-resize storms arrive per-frame; coalesce onto one rAF so each
    // frame settles for a single setState instead of one per resize event.
    let frame: number | null = null
    const onResize = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        setSize({ width: window.innerWidth, height: window.innerHeight })
      })
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  return size
}
