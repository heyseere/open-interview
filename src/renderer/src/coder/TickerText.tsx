import { useEffect, useRef } from 'react'

/**
 * Single-line text display that keeps the tail visible: whenever the content
 * overflows the container, the line slides left so the newest part shows.
 */
export function TickerText({ text, className }: { text: string; className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const textEl = textRef.current
    const containerEl = containerRef.current
    if (!textEl || !containerEl) return
    // Keep the newest content visible: shift the line left by the overflow
    const overflow = Math.max(0, textEl.scrollWidth - containerEl.clientWidth)
    textEl.style.transform = `translateX(${-overflow}px)`
  }, [text])

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className ?? ''}`}>
      <span ref={textRef} className="inline-block">
        {text}
      </span>
    </div>
  )
}
