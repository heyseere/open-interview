import { describe, expect, it, vi } from 'vitest'
import { createStreamingAsr, type StreamingResult } from './streaming-asr'

const BYTES_PER_SECOND = 32_000 // 16 kHz × 2 bytes

/** PCM16 buffer of `ms` milliseconds with a constant sample value. */
function pcm(ms: number, amplitude = 0.5): Buffer {
  const samples = Math.round((ms / 1000) * 16_000)
  const buffer = Buffer.alloc(samples * 2)
  const value = Math.round(amplitude * 32767)
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(value, i * 2)
  return buffer
}

interface Harness {
  asr: ReturnType<typeof createStreamingAsr>
  commits: string[]
  partials: string[]
  errors: string[]
  prompts: string[]
}

/** Build an engine whose recognizer is driven by a scripted callback. */
function makeHarness(
  respond: (windowMs: number, call: number) => StreamingResult,
  options: { silenceRms?: number } = {}
): Harness {
  const commits: string[] = []
  const partials: string[] = []
  const errors: string[] = []
  const prompts: string[] = []
  let call = 0
  const asr = createStreamingAsr({
    transcribe: async (buffer, prompt) => {
      prompts.push(prompt)
      call++
      return respond((buffer.length / BYTES_PER_SECOND) * 1000, call)
    },
    onCommit: (text) => commits.push(text),
    onPartial: (text) => partials.push(text),
    onError: (message) => errors.push(message),
    bytesPerSecond: BYTES_PER_SECOND,
    // Deterministic levels: the harness feeds loud audio unless a test asks
    // for the silence gate.
    computeRms: () => 0.5,
    ...options
  })
  return { asr, commits, partials, errors, prompts }
}

describe('createStreamingAsr', () => {
  it('does nothing until enough new audio arrived', async () => {
    const { asr, commits } = makeHarness(() => ({
      text: 'hi',
      segments: [{ start: 0, end: 0.5, text: 'hi' }]
    }))
    asr.push(pcm(200))
    await asr.tick()
    expect(commits).toEqual([])
  })

  it('commits the finished span and keeps the tail as partial', async () => {
    const { asr, commits, partials } = makeHarness((windowMs) => ({
      text: 'A B',
      segments: [
        { start: 0, end: 1, text: 'A' },
        // 300 ms of silence, then a span running into the safety margin.
        { start: 1.3, end: windowMs / 1000, text: 'B' }
      ]
    }))
    asr.push(pcm(3000))
    await asr.tick()
    expect(commits).toEqual(['A'])
    expect(partials.at(-1)).toBe('B')
  })

  it('drops committed audio so the next window starts at the boundary', async () => {
    const windows: number[] = []
    const { asr } = makeHarness((windowMs) => {
      windows.push(windowMs)
      // One segment ending at 2 s regardless of window length.
      return { text: 'A', segments: [{ start: 0, end: 2, text: 'A' }] }
    })
    asr.push(pcm(4000))
    await asr.tick()
    // 4000 ms in, 2000 ms committed → 2000 ms left in the buffer.
    expect(asr.pendingMs).toBeCloseTo(2000, -1)
    asr.push(pcm(2000))
    await asr.tick()
    // Second window is 2000 (leftover) + 2000 (new) = 4000 ms, not 6000.
    expect(windows[1]).toBeCloseTo(4000, -1)
  })

  it('never re-commits the same text', async () => {
    // A realistic recognizer: the first second of every window is new speech,
    // because committed audio was trimmed away. Each window yields different
    // words, so a replay of committed audio would surface as a duplicate
    // rather than being masked by the boundary-overlap rule.
    const { asr, commits } = makeHarness((windowMs, call) => {
      const word = `第${call}段`
      return {
        text: word,
        segments: [{ start: 0, end: Math.min(1, windowMs / 1000), text: word }]
      }
    })
    asr.push(pcm(2000))
    await asr.tick()
    asr.push(pcm(2000))
    await asr.tick()
    asr.push(pcm(2000))
    await asr.tick()
    expect(commits).toEqual(['第1段', '第2段', '第3段'])
  })

  it('skips the round trip entirely on silence', async () => {
    const transcribe = vi.fn(async () => ({ text: 'hallucination', segments: [] }))
    const asr = createStreamingAsr({
      transcribe,
      onCommit: () => undefined,
      onPartial: () => undefined,
      bytesPerSecond: BYTES_PER_SECOND,
      computeRms: () => 0
    })
    asr.push(pcm(2000))
    await asr.tick()
    expect(transcribe).not.toHaveBeenCalled()
  })

  it('reports failures without throwing and keeps the buffer', async () => {
    const { asr, errors, commits } = makeHarness(() => {
      throw new Error('boom')
    })
    asr.push(pcm(2000))
    await asr.tick()
    expect(errors).toEqual(['boom'])
    expect(commits).toEqual([])
    expect(asr.pendingMs).toBeCloseTo(2000, -1)
  })

  it('finalize commits the remaining tail that the margin was holding back', async () => {
    // Call 1 sees A (stable) + B (inside the safety margin). After A is
    // committed its audio is trimmed, so call 2 sees only the audio that is
    // still uncommitted — exactly one segment, B.
    const { asr, commits, partials } = makeHarness((windowMs, call) =>
      call === 1
        ? {
            text: 'A B',
            segments: [
              { start: 0, end: 1, text: 'A' },
              // 300 ms pause → A is a safe cut point.
              { start: 1.3, end: windowMs / 1000, text: 'B' }
            ]
          }
        : { text: 'B', segments: [{ start: 0, end: windowMs / 1000, text: 'B' }] }
    )
    asr.push(pcm(3000))
    await asr.tick()
    expect(commits).toEqual(['A'])
    await asr.finalize()
    expect(commits).toEqual(['A', 'B'])
    expect(partials.at(-1)).toBe('')
  })

  it('finalize falls back to the whole text when no segments are returned', async () => {
    const { asr, commits } = makeHarness(() => ({ text: 'plain', segments: [] }))
    asr.push(pcm(2000))
    await asr.finalize()
    expect(commits).toEqual(['plain'])
  })

  it('reset clears committed text and buffer', async () => {
    const { asr, commits } = makeHarness(() => ({
      text: 'x',
      segments: [{ start: 0, end: 1, text: 'x' }]
    }))
    asr.push(pcm(2000))
    await asr.tick()
    expect(commits).toEqual(['x'])
    asr.reset()
    expect(asr.committedText).toBe('')
    expect(asr.partialText).toBe('')
    expect(asr.pendingMs).toBe(0)
  })

  it('cancel drops everything and ignores later audio', async () => {
    const { asr, commits } = makeHarness(() => ({
      text: 'x',
      segments: [{ start: 0, end: 1, text: 'x' }]
    }))
    asr.push(pcm(2000))
    asr.cancel()
    await asr.tick()
    asr.push(pcm(2000))
    await asr.tick()
    expect(commits).toEqual([])
    expect(asr.pendingMs).toBe(0)
  })

  it('caps the window so a long silence cannot grow the buffer without bound', async () => {
    const asr = createStreamingAsr({
      transcribe: async () => ({ text: '', segments: [] }),
      onCommit: () => undefined,
      onPartial: () => undefined,
      bytesPerSecond: BYTES_PER_SECOND,
      computeRms: () => 0,
      maxWindowMs: 5000,
      safetyMarginMs: 500
    })
    for (let i = 0; i < 20; i++) asr.push(pcm(1000))
    await asr.tick()
    expect(asr.pendingMs).toBeLessThanOrEqual(5000)
  })

  it('feeds the committed tail back as the decoder prompt', async () => {
    const { asr, prompts } = makeHarness(() => ({
      text: '上下文',
      segments: [{ start: 0, end: 1, text: '上下文' }]
    }))
    asr.push(pcm(2000))
    await asr.tick()
    expect(prompts[0]).toBe('')
    asr.push(pcm(2000))
    await asr.tick()
    expect(prompts[1]).toContain('上下文')
  })
})

describe('boundary overlap handling', () => {
  it('drops the part of a segment that repeats the committed tail', async () => {
    // A recognizer that still sees a sliver of the previous window returns
    // the overlap again; the naive concatenation would repeat "这句话".
    const { asr, commits } = makeHarness((windowMs, call) =>
      call === 1
        ? { text: '这是第一句话', segments: [{ start: 0, end: 1, text: '这是第一句话' }] }
        : {
            text: '句话第二句',
            segments: [{ start: 0, end: Math.min(1, windowMs / 1000), text: '句话第二句' }]
          }
    )
    asr.push(pcm(2000))
    await asr.tick()
    asr.push(pcm(2000))
    await asr.tick()
    expect(commits.join('')).toBe('这是第一句话第二句')
  })

  it('keeps legitimately repeated words inside one segment', async () => {
    const { asr, commits } = makeHarness(() => ({
      text: '好 好',
      segments: [{ start: 0, end: 1, text: '好 好' }]
    }))
    asr.push(pcm(2000))
    await asr.tick()
    expect(commits.join('')).toBe('好 好')
  })
})

describe('pause-aligned commit', () => {
  it('waits for a pause instead of cutting mid-sentence', async () => {
    // The second segment runs right up to the safety margin, so it is not
    // finished. The first has no pause behind it either (the next segment
    // starts immediately) and the window is short — so nothing is committed
    // and the audio stays intact for the next round.
    const { asr, commits, partials } = makeHarness(() => ({
      text: '前半句后半句',
      segments: [
        { start: 0, end: 1, text: '前半句' },
        { start: 1, end: 2.4, text: '后半句' }
      ]
    }))
    asr.push(pcm(3000))
    await asr.tick()
    expect(commits).toEqual([])
    expect(partials.at(-1)).toBe('前半句后半句')
    expect(asr.pendingMs).toBeCloseTo(3000, -1)
  })

  it('commits up to the last segment that ends on a pause', async () => {
    const { asr, commits } = makeHarness(() => ({
      text: '第一句第二句',
      segments: [
        { start: 0, end: 1, text: '第一句' },
        // 400 ms of silence before the next segment → a safe cut.
        { start: 1.4, end: 2.5, text: '第二句' }
      ]
    }))
    asr.push(pcm(4000))
    await asr.tick()
    // Both are finished and the first has a real pause behind it, so the cut
    // lands after 第二句 (the last finished segment).
    expect(commits.join('')).toBe('第一句第二句')
  })

  it('forces a cut once the window is long enough to stall', async () => {
    const { asr, commits } = makeHarness(() => ({
      text: '连续语流',
      segments: [{ start: 0, end: 8, text: '连续语流' }]
    }))
    asr.push(pcm(10_000))
    await asr.tick()
    expect(commits.join('')).toBe('连续语流')
  })
})

describe('punctuation-insensitive overlap', () => {
  it('drops a re-recognized phrase even when it is punctuated differently', async () => {
    const { asr, commits } = makeHarness((windowMs, call) =>
      call === 1
        ? {
            text: '看看能不能把长音频',
            segments: [{ start: 0, end: 1, text: '看看能不能把长音频' }]
          }
        : {
            // Same words, different punctuation at the seam.
            text: '看看。能不能把长音频切成多个片段',
            segments: [
              {
                start: 0,
                end: Math.min(1, windowMs / 1000),
                text: '看看。能不能把长音频切成多个片段'
              }
            ]
          }
    )
    asr.push(pcm(2000))
    await asr.tick()
    asr.push(pcm(2000))
    await asr.tick()
    expect(commits.join('')).toBe('看看能不能把长音频切成多个片段')
  })

  it('does not swallow a genuinely new short word that happens to repeat', async () => {
    const { asr, commits } = makeHarness((windowMs, call) =>
      call === 1
        ? { text: '好', segments: [{ start: 0, end: 1, text: '好' }] }
        : {
            text: '好，我们继续',
            segments: [{ start: 0, end: Math.min(1, windowMs / 1000), text: '好，我们继续' }]
          }
    )
    asr.push(pcm(2000))
    await asr.tick()
    asr.push(pcm(2000))
    await asr.tick()
    expect(commits.join('')).toBe('好我们继续')
  })
})

describe('stop path vs in-flight tick', () => {
  // 30 non-ignorable chars: far past MAX_OVERLAP_CHARS, so a double commit of
  // this text cannot be masked by the boundary-overlap rule.
  const LONG = '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十'
  const RESULT: StreamingResult = { text: LONG, segments: [{ start: 0, end: 2, text: LONG }] }

  /** Recognizer whose responses are released manually, in call order. */
  function makeDeferredHarness() {
    const commits: string[] = []
    const partials: string[] = []
    const resolvers: Array<(result: StreamingResult) => void> = []
    const asr = createStreamingAsr({
      transcribe: () => new Promise<StreamingResult>((resolve) => resolvers.push(resolve)),
      onCommit: (text) => commits.push(text),
      onPartial: (text) => partials.push(text),
      bytesPerSecond: BYTES_PER_SECOND,
      computeRms: () => 0.5
    })
    return { asr, commits, partials, resolvers }
  }

  it('finalize supersedes an in-flight tick: the same window commits once', async () => {
    // stopTranscription clears the timer but not an already-dispatched request:
    // tick and finalize then transcribe the SAME buffer. Whichever response
    // lands second must be discarded, not appended.
    const { asr, commits, resolvers } = makeDeferredHarness()
    asr.push(pcm(3000))
    const tickPromise = asr.tick()
    const finalizePromise = asr.finalize()
    resolvers[0](RESULT)
    await tickPromise
    resolvers[1](RESULT)
    await finalizePromise
    expect(commits.join('')).toBe(LONG)
    expect(asr.committedText).toBe(LONG)
  })

  it('a late tick response after finalize committed leaves no stale partial', async () => {
    const { asr, commits, resolvers } = makeDeferredHarness()
    asr.push(pcm(3000))
    const tickPromise = asr.tick()
    const finalizePromise = asr.finalize()
    resolvers[1](RESULT)
    await finalizePromise
    resolvers[0](RESULT)
    await tickPromise
    expect(commits.join('')).toBe(LONG)
    expect(asr.partialText).toBe('')
  })
})
