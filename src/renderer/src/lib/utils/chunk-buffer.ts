/**
 * Coalesces small string chunks and delivers them in batches after `delayMs`,
 * so high-frequency streams cause one state update per window instead of one
 * per chunk. Used by the renderer solution store to batch streaming chunks
 * into one state update per window.
 */
export class ChunkBuffer {
  private items: string[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: { delayMs: number; onFlush: (items: string[]) => void }) {}

  /** Number of chunks waiting in the current window. */
  get size(): number {
    return this.items.length
  }

  push(item: string): void {
    if (!item) return
    this.items.push(item)
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.options.delayMs)
    }
  }

  /** Deliver buffered chunks immediately and close the open window. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.items.length === 0) return
    const batch = this.items
    this.items = []
    this.options.onFlush(batch)
  }
}
