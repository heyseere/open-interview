import { describe, expect, it } from 'vitest'
import { computeRms, SilenceDetector } from './vad'

describe('computeRms', () => {
  it('is 0 for silence and 1 for full-scale alternating signal', () => {
    expect(computeRms(new Float32Array(128))).toBe(0)
    expect(computeRms(new Float32Array([1, -1, 1, -1]))).toBe(1)
  })

  it('handles empty frames', () => {
    expect(computeRms(new Float32Array([]))).toBe(0)
  })
})

describe('SilenceDetector', () => {
  const SPEECH = 0.05
  const QUIET = 0.0001
  const AMBIGUOUS = (0.015 + 0.008) / 2

  it('triggers exactly once after sustained silence following speech', () => {
    const detector = new SilenceDetector(1500)
    detector.process(SPEECH, 0)

    let triggers = 0
    for (let t = 100; t <= 3000; t += 100) {
      if (detector.process(QUIET, t)) triggers++
    }
    expect(triggers).toBe(1)
  })

  it('never triggers without prior speech', () => {
    const detector = new SilenceDetector(100)
    for (let t = 0; t <= 10_000; t += 50) {
      expect(detector.process(QUIET, t)).toBe(false)
    }
  })

  it('does not trigger while speech keeps interrupting the silence window', () => {
    const detector = new SilenceDetector(500)
    let triggered = false
    for (let t = 0; t < 5000; t += 100) {
      // A loud frame every 300ms keeps resetting the silence window
      triggered = detector.process(t % 300 === 0 ? SPEECH : QUIET, t) || triggered
    }
    expect(triggered).toBe(false)
    expect(detector.process(QUIET, 5000)).toBe(false)
  })

  it('requires fresh speech before firing a second time', () => {
    const detector = new SilenceDetector(1000)

    detector.process(SPEECH, 0)
    let firstTriggered = false
    for (let t = 200; t <= 2000 && !firstTriggered; t += 200) {
      firstTriggered = detector.process(QUIET, t)
    }
    expect(firstTriggered).toBe(true)

    // Continued silence stays silent
    expect(detector.process(QUIET, 9999)).toBe(false)

    // Fresh speech re-arms the detector (window counts from the first quiet frame)
    detector.process(SPEECH, 10_000)
    expect(detector.process(QUIET, 10_500)).toBe(false) // opens the window
    expect(detector.process(QUIET, 11_499)).toBe(false) // 999ms elapsed
    expect(detector.process(QUIET, 11_500)).toBe(true) // 1000ms reached
  })

  it('ignores frames inside the hysteresis band without breaking the window', () => {
    const detector = new SilenceDetector(1000)
    detector.process(SPEECH, 0)
    detector.process(QUIET, 100)
    // Ambiguous frames neither restart the silence window nor count as quiet
    expect(detector.process(AMBIGUOUS, 200)).toBe(false)
    expect(detector.process(QUIET, 1100)).toBe(true) // window still runs from t=100
  })

  it('reset clears all state so pending windows are discarded', () => {
    const detector = new SilenceDetector(500)
    detector.process(SPEECH, 0)
    detector.process(QUIET, 400) // pending, not yet fired

    detector.reset()
    for (let t = 500; t <= 5000; t += 100) {
      expect(detector.process(QUIET, t)).toBe(false)
    }
  })
})
