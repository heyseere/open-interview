import { describe, expect, it } from 'vitest'
import { measureScrollState } from './scroll-state'

const base = { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 }

describe('measureScrollState', () => {
  it('reports a scrollable container in the middle of its range', () => {
    expect(measureScrollState({ ...base, scrollTop: 300 })).toEqual({
      scrollable: true,
      atTop: false,
      atBottom: false
    })
  })

  it('treats a container that fits its content as not scrollable', () => {
    expect(measureScrollState({ scrollTop: 0, scrollHeight: 400, clientHeight: 400 })).toEqual({
      scrollable: false,
      atTop: true,
      atBottom: true
    })
  })

  it('ignores overflow smaller than the 4px threshold', () => {
    // Sub-pixel layout rounding must not make a short page sprout a rail
    expect(
      measureScrollState({ scrollTop: 0, scrollHeight: 404, clientHeight: 400 }).scrollable
    ).toBe(false)
    expect(
      measureScrollState({ scrollTop: 0, scrollHeight: 405, clientHeight: 400 }).scrollable
    ).toBe(true)
  })

  it('counts the first and last pixel as the edge', () => {
    expect(measureScrollState({ ...base, scrollTop: 0 }).atTop).toBe(true)
    expect(measureScrollState({ ...base, scrollTop: 1 }).atTop).toBe(true)
    expect(measureScrollState({ ...base, scrollTop: 1.5 }).atTop).toBe(false)
    // 1000 - 600 - 400 = 0 → bottom
    expect(measureScrollState({ ...base, scrollTop: 600 }).atBottom).toBe(true)
    expect(measureScrollState({ ...base, scrollTop: 599 }).atBottom).toBe(true)
    expect(measureScrollState({ ...base, scrollTop: 598.5 }).atBottom).toBe(false)
    expect(measureScrollState({ ...base, scrollTop: 598 }).atBottom).toBe(false)
  })

  it('can be scrollable and at both edges at once only when it does not overflow', () => {
    const state = measureScrollState({ scrollTop: 0, scrollHeight: 200, clientHeight: 400 })
    expect(state.scrollable).toBe(false)
    expect(state.atTop && state.atBottom).toBe(true)
  })
})
