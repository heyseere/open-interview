import { describe, expect, it } from 'vitest'
import {
  FULL_PAGE_BUDGET,
  SCREENSHOT_BUDGET,
  fitDimensions,
  shrinkFactorForBytes
} from './image-budget'

describe('fitDimensions', () => {
  it('leaves already-small images untouched', () => {
    expect(fitDimensions({ width: 800, height: 600 }, SCREENSHOT_BUDGET)).toEqual({
      width: 800,
      height: 600
    })
  })

  it('clamps the long edge and preserves the aspect ratio', () => {
    expect(fitDimensions({ width: 3200, height: 2000 }, SCREENSHOT_BUDGET)).toEqual({
      width: 1600,
      height: 1000
    })
  })

  it('clamps very tall pages by the edge and pixel budgets', () => {
    const fitted = fitDimensions({ width: 4000, height: 20000 }, FULL_PAGE_BUDGET)
    expect(Math.max(fitted.width, fitted.height)).toBeLessThanOrEqual(FULL_PAGE_BUDGET.maxEdge)
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(FULL_PAGE_BUDGET.maxPixels)
    expect(fitted.width / fitted.height).toBeCloseTo(4000 / 20000, 2)
  })

  it('applies the pixel budget on top of the edge budget', () => {
    const fitted = fitDimensions({ width: 4000, height: 4000 }, SCREENSHOT_BUDGET)
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(SCREENSHOT_BUDGET.maxPixels + 1)
  })

  it('returns zero for degenerate input', () => {
    expect(fitDimensions({ width: 0, height: 100 }, SCREENSHOT_BUDGET)).toEqual({
      width: 0,
      height: 0
    })
  })
})

describe('shrinkFactorForBytes', () => {
  it('returns 1 when the payload fits', () => {
    expect(shrinkFactorForBytes(500_000, 1_000_000)).toBe(1)
    expect(shrinkFactorForBytes(1_000_000, 1_000_000)).toBe(1)
  })

  it('scales with the square root of the overshoot', () => {
    // 4× too big ⇒ halve each dimension
    expect(shrinkFactorForBytes(4_000_000, 1_000_000)).toBeCloseTo(0.5, 5)
  })

  it('never collapses the image', () => {
    expect(shrinkFactorForBytes(1e12, 1)).toBeGreaterThanOrEqual(0.1)
  })
})
