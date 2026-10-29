import { describe, expect, it } from 'vitest'
import { sanitizeWindowBounds, type DisplayArea } from './window-bounds'

const PRIMARY: DisplayArea = { workArea: { x: 0, y: 0, width: 1440, height: 900 } }
const SECONDARY: DisplayArea = { workArea: { x: -1920, y: 0, width: 1920, height: 1057 } }
const DISPLAYS = [PRIMARY, SECONDARY]

describe('sanitizeWindowBounds', () => {
  it('accepts well-formed on-screen bounds and rounds them', () => {
    expect(
      sanitizeWindowBounds({ x: 10.4, y: 20.6, width: 900.2, height: 670.8 }, DISPLAYS)
    ).toEqual({ x: 10, y: 21, width: 900, height: 671 })
  })

  it('accepts bounds on a secondary display left of the primary', () => {
    expect(sanitizeWindowBounds({ x: -1800, y: 50, width: 800, height: 600 }, DISPLAYS)).toEqual({
      x: -1800,
      y: 50,
      width: 800,
      height: 600
    })
  })

  it('rejects the offscreen soft-hide park position', () => {
    expect(sanitizeWindowBounds({ x: 99992, y: 0, width: 900, height: 670 }, DISPLAYS)).toBeNull()
  })

  it('rejects bounds barely peeking onto any display', () => {
    expect(sanitizeWindowBounds({ x: 1400, y: 850, width: 900, height: 670 }, DISPLAYS)).toBeNull()
  })

  it('rejects windows smaller than the minimum size', () => {
    expect(sanitizeWindowBounds({ x: 0, y: 0, width: 100, height: 670 }, DISPLAYS)).toBeNull()
    expect(sanitizeWindowBounds({ x: 0, y: 0, width: 900, height: 32 }, DISPLAYS)).toBeNull()
  })

  it('rejects malformed records', () => {
    expect(sanitizeWindowBounds(null, DISPLAYS)).toBeNull()
    expect(sanitizeWindowBounds('nope', DISPLAYS)).toBeNull()
    expect(
      sanitizeWindowBounds({ x: Number.NaN, y: 0, width: 900, height: 670 }, DISPLAYS)
    ).toBeNull()
    expect(sanitizeWindowBounds({ x: 0, y: 0, width: '900', height: 670 }, DISPLAYS)).toBeNull()
  })

  it('rejects everything when no displays are reported', () => {
    expect(sanitizeWindowBounds({ x: 0, y: 0, width: 900, height: 670 }, [])).toBeNull()
  })
})
