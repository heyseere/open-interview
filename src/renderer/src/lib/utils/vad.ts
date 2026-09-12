/** RMS level above which a frame counts as speech. */
export const SPEECH_OPEN_THRESHOLD = 0.015
/** RMS level below which a frame counts as quiet (hysteresis band between). */
export const SPEECH_CLOSE_THRESHOLD = 0.008

/** Root mean square of a float32 audio frame (samples in [-1, 1]). */
export function computeRms(samples: Float32Array): number {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

/**
 * Frame-energy voice activity detector used to auto-submit transcriptions.
 *
 * Speech opens when a frame reaches `openThreshold`; the channel closes below
 * `closeThreshold`. Once speech was detected, a continuous stretch of closed
 * audio spanning `silenceMs` fires exactly once, then the detector requires
 * fresh speech before it can fire again. Frames inside the hysteresis band
 * are ignored (they neither start nor interrupt the silence window).
 */
export class SilenceDetector {
  private hasSpeech = false
  private silenceStartedAt: number | null = null

  constructor(
    private readonly silenceMs: number,
    private readonly openThreshold: number = SPEECH_OPEN_THRESHOLD,
    private readonly closeThreshold: number = SPEECH_CLOSE_THRESHOLD
  ) {}

  /** Feed one frame; returns true exactly once per completed silence window. */
  process(rms: number, timestampMs: number): boolean {
    if (rms >= this.openThreshold) {
      this.hasSpeech = true
      this.silenceStartedAt = null
      return false
    }
    if (!this.hasSpeech || rms > this.closeThreshold) return false
    if (this.silenceStartedAt === null) {
      this.silenceStartedAt = timestampMs
      return false
    }
    if (timestampMs - this.silenceStartedAt >= this.silenceMs) {
      this.silenceStartedAt = null
      this.hasSpeech = false
      return true
    }
    return false
  }

  reset(): void {
    this.hasSpeech = false
    this.silenceStartedAt = null
  }
}
