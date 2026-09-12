import { describe, expect, it } from 'vitest'
import {
  normalizeChunkSeconds,
  normalizeToolbarDwellMs,
  CHUNK_SECONDS_DEFAULT,
  TOOLBAR_DWELL_DEFAULT
} from './settings'

/**
 * Storage is v1 since the 1.0.0 "Open Interview" reset (new localStorage
 * keys, no migration chain) — the persisted helpers that stay pure and
 * unit-tested are the stepper normalizers below.
 */
describe('normalizeChunkSeconds', () => {
  it('snaps to the 1s grid', () => {
    expect(normalizeChunkSeconds(5.4)).toBe(5)
    expect(normalizeChunkSeconds(7.6)).toBe(8)
  })

  it('clamps into the 3–15s range', () => {
    expect(normalizeChunkSeconds(1)).toBe(3)
    expect(normalizeChunkSeconds(99)).toBe(15)
  })

  it('falls back to the default for non-finite values', () => {
    expect(normalizeChunkSeconds(Number.NaN)).toBe(CHUNK_SECONDS_DEFAULT)
  })
})

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
