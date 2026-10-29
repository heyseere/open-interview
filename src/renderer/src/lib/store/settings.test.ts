import { describe, expect, it } from 'vitest'
import { normalizeToolbarDwellMs, TOOLBAR_DWELL_DEFAULT } from './settings'

/**
 * Storage is v1 since the 1.0.0 "Open Interview" reset (new localStorage
 * keys, no migration chain) — the persisted helper that stays pure and
 * unit-tested is the dwell stepper normalizer below.
 */
describe('normalizeToolbarDwellMs', () => {
  it('snaps to the 0.1s grid', () => {
    expect(normalizeToolbarDwellMs(460)).toBe(500)
    expect(normalizeToolbarDwellMs(240)).toBe(200)
  })

  it('clamps into the 0.2–1s range', () => {
    expect(normalizeToolbarDwellMs(0)).toBe(200)
    expect(normalizeToolbarDwellMs(2000)).toBe(1000)
  })

  it('falls back to the default for non-finite values', () => {
    expect(normalizeToolbarDwellMs(Number.NaN)).toBe(TOOLBAR_DWELL_DEFAULT)
  })
})
