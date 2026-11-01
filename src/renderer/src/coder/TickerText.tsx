import { useEffect, useRef } from 'react'

/**
 * Single-line text display that keeps the tail visible: whenever the content
 * overflows the container, the line slides left so the newest part shows.
 */
export function TickerText({ text, className }: { text: string; className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const applyRef = useRef<() => void>(() => {})

  useEffect(() => {
    const textEl = textRef.current
    const containerEl = containerRef.current
    if (!textEl || !containerEl) return
    // Keep the newest content visible: shift the line left by the overflow
    const apply = () => {
      const overflow = Math.max(0, textEl.scrollWidth - containerEl.clientWidth)
      textEl.style.transform = `translateX(${-overflow}px)`
    }
    applyRef.current = apply
    apply()
    // The offset also goes stale when the CONTAINER resizes (compact panel
    // grip, window resize), so re-measure on size changes, not just text.
    // Mounted once for the component's lifetime — the old [text] dependency
    // rebuilt (disconnect + new ResizeObserver) the observer per streamed
    // chunk; text changes re-apply through the ref below instead.
    const observer = new ResizeObserver(() => applyRef.current())
    observer.observe(containerEl)
    return () => observer.disconnect()
  }, [])

  // New content changes the text element's width: re-measure (no rebuild).
  useEffect(() => {
    applyRef.current()
  }, [text])

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className ?? ''}`}>
      <span ref={textRef} className="inline-block">
        {text}
      </span>
    </div>
  )
}
