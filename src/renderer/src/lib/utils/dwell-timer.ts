export interface DwellTimerOptions {
  /** Total hover time before firing; <= 0 disables the timer entirely. */
  durationMs: number
  /** Progress callback, 0..1 (1 right before firing). */
  onProgress: (progress: number) => void
  /** Fired exactly once when the dwell completes. */
  onFire: () => void
  /** Tick resolution; also drives test determinism. */
  intervalMs?: number
  /** Injectable monotonic clock for tests. */
  now?: () => number
}

/**
 * Dwell-to-activate timing for hover toolbar buttons. Begin on mouse enter,
 * cancel on leave; reports fractional progress each tick and fires once when
 * the full duration elapses.
 */
export class DwellTimer {
  private handle: ReturnType<typeof setInterval> | null = null

  constructor(private readonly options: DwellTimerOptions) {}

  get running(): boolean {
    return this.handle !== null
  }

  begin(): void {
    if (this.running || this.options.durationMs <= 0) return
    const now = this.options.now ?? ((() => performance.now()) as () => number)
    const interval = this.options.intervalMs ?? 33
    const startedAt = now()
    this.handle = setInterval(() => {
      const elapsed = now() - startedAt
      if (elapsed >= this.options.durationMs) {
        this.stop()
        this.options.onProgress(1)
        this.options.onFire()
        return
      }
      this.options.onProgress(elapsed / this.options.durationMs)
    }, interval)
  }

  /** Stop ticking without firing. */
  cancel(): void {
    this.stop()
  }

  dispose(): void {
    this.stop()
  }

  private stop(): void {
    if (this.handle !== null) {
      clearInterval(this.handle)
      this.handle = null
    }
  }
}
