/**
 * Audio level measurement shared by the renderer capture graph and the main
 * process streaming engine.
 *
 * Two representations of the same signal cross this codebase: the renderer
 * holds Float32 samples in [-1, 1] (Web Audio), the main process receives
 * little-endian PCM16. Both are normalized to the same [-1, 1] scale before
 * squaring so a threshold means the same thing on either side — the VAD
 * auto-submit thresholds and the ASR silence gate are directly comparable.
 */

/** PCM16 full-scale magnitude: |−32768| maps to 1.0. */
export const PCM16_FULL_SCALE = 32768

/** Root mean square of Float32 samples in [-1, 1]. */
export function rmsFloat32(samples: Float32Array): number {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

/** Root mean square of little-endian mono PCM16 samples. */
export function rmsPcm16(pcm: Buffer): number {
  const samples = Math.floor(pcm.length / 2)
  if (samples === 0) return 0
  let sum = 0
  for (let i = 0; i < samples; i++) {
    const value = pcm.readInt16LE(i * 2) / PCM16_FULL_SCALE
    sum += value * value
  }
  return Math.sqrt(sum / samples)
}
