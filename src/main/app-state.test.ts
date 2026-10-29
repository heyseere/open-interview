import { describe, expect, it } from 'vitest'
import { applyAppStatePatch, togglePassthroughState, type AppState } from './app-state'

function state(overrides: Partial<AppState> = {}): AppState {
  return { inCoderPage: false, passthrough: false, ignoreMouse: false, ...overrides }
}

describe('applyAppStatePatch', () => {
  it('ignores non-object patches', () => {
    for (const patch of [null, undefined, 'x', 42, [1, 2]]) {
      const current = state({ passthrough: true, ignoreMouse: true })
      expect(applyAppStatePatch(current, patch)).toBe(false)
      expect(current).toEqual(state({ passthrough: true, ignoreMouse: true }))
    }
  })

  it('adopts a passthrough intent and applies it immediately', () => {
    const current = state()
    expect(applyAppStatePatch(current, { passthrough: true })).toBe(true)
    expect(current.passthrough).toBe(true)
    expect(current.ignoreMouse).toBe(true)
  })

  it('drops the effective value when the intent is switched off', () => {
    const current = state({ passthrough: true, ignoreMouse: true })
    expect(applyAppStatePatch(current, { passthrough: false })).toBe(true)
    expect(current.passthrough).toBe(false)
    expect(current.ignoreMouse).toBe(false)
  })

  it('lets a lift clear the effective value without touching the intent', () => {
    const current = state({ passthrough: true, ignoreMouse: true })
    expect(applyAppStatePatch(current, { ignoreMouse: false })).toBe(true)
    // The mode is still ON: this is what makes the header icon stay correct
    // while the pointer hovers a lift surface.
    expect(current.passthrough).toBe(true)
    expect(current.ignoreMouse).toBe(false)
  })

  it('never arms passthrough from a lift request when the intent is off', () => {
    // The regression this guards: a stale lift asking for `true` must not
    // re-enable a mode the user turned off.
    const current = state({ passthrough: false, ignoreMouse: false })
    expect(applyAppStatePatch(current, { ignoreMouse: true })).toBe(false)
    expect(current.ignoreMouse).toBe(false)
  })

  it('honours an arm request while the intent is on', () => {
    const current = state({ passthrough: true, ignoreMouse: false })
    expect(applyAppStatePatch(current, { ignoreMouse: true })).toBe(true)
    expect(current.ignoreMouse).toBe(true)
  })

  it('reports no change when the effective value is already correct', () => {
    const current = state({ passthrough: true, ignoreMouse: true })
    expect(applyAppStatePatch(current, { ignoreMouse: true })).toBe(false)
  })

  it('tracks inCoderPage without touching passthrough', () => {
    const current = state({ passthrough: true, ignoreMouse: false })
    expect(applyAppStatePatch(current, { inCoderPage: true })).toBe(false)
    expect(current.inCoderPage).toBe(true)
    expect(current.passthrough).toBe(true)
    expect(current.ignoreMouse).toBe(false)
  })
})

describe('togglePassthroughState', () => {
  it('turns the mode on and returns the effective value', () => {
    const current = state()
    expect(togglePassthroughState(current)).toBe(true)
    expect(current.passthrough).toBe(true)
    expect(current.ignoreMouse).toBe(true)
  })

  it('turns the mode off even while a lift is active', () => {
    // Intent on, effective off (pointer hovering the header): the toggle must
    // still disable the mode — the old code read the lifted value and
    // re-armed instead.
    const current = state({ passthrough: true, ignoreMouse: false })
    expect(togglePassthroughState(current)).toBe(false)
    expect(current.passthrough).toBe(false)
    expect(current.ignoreMouse).toBe(false)
  })

  it('round-trips back to the original pair', () => {
    const current = state({ passthrough: true, ignoreMouse: true })
    togglePassthroughState(current)
    togglePassthroughState(current)
    expect(current.passthrough).toBe(true)
    expect(current.ignoreMouse).toBe(true)
  })
})
