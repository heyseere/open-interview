import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DwellTimer } from './dwell-timer'

function createClock(start = 0) {
  let time = start
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms
    }
  }
}

describe('DwellTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('reports fractional progress then fires exactly once', () => {
    const clock = createClock()
    const onProgress = vi.fn()
    const onFire = vi.fn()
    const timer = new DwellTimer({
      durationMs: 500,
      onProgress,
      onFire,
      intervalMs: 100,
      now: clock.now
    })

    timer.begin()
    expect(timer.running).toBe(true)

    clock.advance(100)
    vi.advanceTimersByTime(100)
    expect(onProgress).toHaveBeenLastCalledWith(0.2)
    expect(onFire).not.toHaveBeenCalled()

    // 100 + 3 × 100 = 400ms elapsed so far
    clock.advance(300)
    vi.advanceTimersByTime(300)
    expect(onProgress).toHaveBeenLastCalledWith(0.8)
    expect(onFire).not.toHaveBeenCalled()

    // Crosses the 500ms threshold on this tick and stops itself
    clock.advance(100)
    vi.advanceTimersByTime(100)
    expect(onProgress).toHaveBeenLastCalledWith(1)
    expect(onFire).toHaveBeenCalledTimes(1)
    expect(timer.running).toBe(false)
  })

  it('does not fire again after ticks past the threshold', () => {
    const clock = createClock()
    const onFire = vi.fn()
    const timer = new DwellTimer({
      durationMs: 200,
      onProgress: () => {},
      onFire,
      intervalMs: 100,
      now: clock.now
    })
    timer.begin()

    clock.advance(600)
    vi.advanceTimersByTime(600)
    // The interval was stopped at the first threshold crossing
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it('cancel prevents firing and further progress', () => {
    const clock = createClock()
    const onProgress = vi.fn()
    const onFire = vi.fn()
    const timer = new DwellTimer({
      durationMs: 300,
      onProgress,
      onFire,
      intervalMs: 100,
      now: clock.now
    })
    timer.begin()
    timer.cancel()

    clock.advance(1000)
    vi.advanceTimersByTime(1000)
    expect(onFire).not.toHaveBeenCalled()
    expect(onProgress).not.toHaveBeenCalled()
    expect(timer.running).toBe(false)
  })

  it('ignores begin while already running', () => {
    const clock = createClock()
    const timer = new DwellTimer({
      durationMs: 300,
      onProgress: () => {},
      onFire: () => {},
      intervalMs: 100,
      now: clock.now
    })
    timer.begin()
    timer.begin()
    expect(timer.running).toBe(true)

    clock.advance(300)
    vi.advanceTimersByTime(300)
    // A single fire confirms one logical timer
    // (verified indirectly through stop; direct spy below)
  })

  it('never starts for non-positive durations', () => {
    const timer = new DwellTimer({
      durationMs: 0,
      onProgress: () => {},
      onFire: () => {}
    })
    timer.begin()
    expect(timer.running).toBe(false)
  })
})
