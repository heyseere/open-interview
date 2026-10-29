/**
 * Image budget for screenshots sent to the AI provider.
 *
 * A screenshot must stay small enough to upload quickly and to fit provider
 * limits, but the exact ceiling depends on the capture: a 5K display or a very
 * long web page can still produce a multi-megabyte base64 payload even after
 * downscaling to a fixed width. So the encoder gets an explicit budget
 * (longest edge, total pixels and encoded bytes) and shrinks until it fits.
 *
 * Pure math, unit-tested; the nativeImage encode loop lives in
 * screenshot.ts (shared with the full-page capture).
 */

export interface ImageBudget {
  /** Longest edge in px (both dimensions are clamped to it). */
  maxEdge: number
  /** Total pixel count ceiling (width × height). */
  maxPixels: number
  /** Encoded base64 length ceiling. */
  maxBase64Bytes: number
}

/** One desktop screenshot: 1600px wide, ~1.6MP, ≤1.2MB of base64. */
export const SCREENSHOT_BUDGET: ImageBudget = {
  maxEdge: 1600,
  maxPixels: 1_600_000,
  maxBase64Bytes: 1_200_000
}

/**
 * A full web page is much taller by nature: the long edge may reach 8000px
 * (Anthropic-class endpoints reject beyond that) and the pixel budget is
 * bigger, but the byte budget still keeps the upload reasonable.
 */
export const FULL_PAGE_BUDGET: ImageBudget = {
  maxEdge: 8000,
  maxPixels: 8_000_000,
  maxBase64Bytes: 1_600_000
}

/** JPEG quality ladder, tried in order until the payload fits. */
export const JPEG_QUALITY_LADDER = [82, 74, 66, 58] as const

export interface Size {
  width: number
  height: number
}

/**
 * Scale `size` down so neither edge exceeds `maxEdge` and the pixel count
 * stays within `maxPixels`. Aspect ratio is preserved (both factors are
 * applied), and a no-op returns the input unchanged so callers can skip an
 * expensive re-encode. Dimensions round DOWN so rounding can never push the
 * result back over the pixel budget.
 */
export function fitDimensions(size: Size, budget: ImageBudget): Size {
  const { width, height } = size
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }

  const edgeScale = Math.min(1, budget.maxEdge / Math.max(width, height))
  const pixelScale = Math.min(1, Math.sqrt(budget.maxPixels / (width * height)))
  const scale = Math.min(edgeScale, pixelScale)
  if (scale >= 1) return { width, height }

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale))
  }
}

/**
 * Scale needed to bring an encoded payload under the byte budget.
 * base64 length grows ~linearly with the pixel count at a fixed quality, so
 * the required linear factor is sqrt(maxBytes / actualBytes).
 *
 * Returns 1 when the payload already fits; the caller must re-encode (and may
 * need to iterate once more, since JPEG size is not perfectly linear).
 */
export function shrinkFactorForBytes(base64Length: number, maxBase64Bytes: number): number {
  if (base64Length <= maxBase64Bytes) return 1
  const factor = Math.sqrt(maxBase64Bytes / base64Length)
  // Never return 0 (would collapse the image); a 10% floor keeps it valid
  return Math.max(0.1, Math.min(1, factor))
}
