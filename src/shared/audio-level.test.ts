import { describe, expect, it } from 'vitest'
import { PCM16_FULL_SCALE, rmsFloat32, rmsPcm16 } from './audio-level'

/**
 * Both normalizers must agree: the renderer's Float32 capture graph and the
 * main process's PCM16 chunks feed the same silence gates, so one signal must
 * measure the same level in either representation.
 */
describe('rmsFloat32', () => {
  it.each([
    ['silence measures zero', new Float32Array([0, 0, 0, 0]), 0],
    ['a full-scale square wave measures 1.0', new Float32Array([1, -1, 1, -1]), 1],
    ['an empty buffer measures zero', new Float32Array([]), 0],
    ['a half-scale sine-ish pair measures ~0.707', new Float32Array([1, 0, -1, 0]), Math.SQRT1_2]
  ])('%s', (_name, samples, expected) => {
    expect(rmsFloat32(samples)).toBeCloseTo(expected, 6)
  })
})

describe('rmsPcm16', () => {
  it('maps full-scale PCM16 onto the same [-1, 1] scale as Float32', () => {
    const pcm = Buffer.alloc(4)
    pcm.writeInt16LE(PCM16_FULL_SCALE - 1, 0)
    pcm.writeInt16LE(-PCM16_FULL_SCALE, 2)
    expect(rmsPcm16(pcm)).toBeCloseTo(1, 3)
  })

  it.each([
    ['digital silence measures zero', Buffer.alloc(8), 0],
    ['an empty buffer measures zero', Buffer.alloc(0), 0]
  ])('%s', (_name, pcm, expected) => {
    expect(rmsPcm16(pcm)).toBe(expected)
  })

  it('ignores a trailing odd byte', () => {
    // floor(3 / 2) = 1 sample, and that sample is zero
    expect(rmsPcm16(Buffer.from([0, 0, 0x7f]))).toBe(0)
  })

  it('measures the same level as rmsFloat32 for the same signal', () => {
    // A quarter-scale square wave: Float32 [-0.25, 0.25] vs PCM16 ±8192
    const float = new Float32Array([0.25, -0.25, 0.25, -0.25])
    const pcm = Buffer.alloc(8)
    pcm.writeInt16LE(8192, 0)
    pcm.writeInt16LE(-8192, 2)
    pcm.writeInt16LE(8192, 4)
    pcm.writeInt16LE(-8192, 6)
    expect(rmsPcm16(pcm)).toBeCloseTo(rmsFloat32(float), 6)
  })
})
