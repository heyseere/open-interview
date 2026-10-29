import { PCM_BYTES_PER_SECOND } from '../shared/asr'
import { rmsPcm16 } from '../shared/audio-level'

/**
 * Sliding-window streaming ASR state machine (no Electron, no network, no
 * timers of its own — the caller drives `tick`).
 *
 * Why not fixed chunks: the previous design cut the audio every N seconds, so
 * a word straddling a boundary was split in two and each chunk paid a full
 * model load. Here the audio buffer grows and is re-transcribed as a whole
 * window; only spans that the recognizer has finished are committed, and the
 * buffer is trimmed past them. That gives (a) word-aligned output, (b) bounded
 * compute (the window is capped, and committed audio is dropped), and (c) a
 * partial transcript that grows while the user is still speaking.
 *
 * Commit rule: a segment is committed only when its `end` falls at least
 * `SAFETY_MARGIN_MS` before the end of the window. whisper re-decodes the tail
 * differently on every tick (it has no right context yet), so committing the
 * last fraction of a second would emit text that changes a moment later.
 *
 * Everything is expressed in milliseconds of 16 kHz mono PCM16.
 */

/** How often the caller should call `tick`. */
export const STEP_MS = 700
/** Do not bother re-transcribing until this much new audio arrived. */
export const MIN_NEW_AUDIO_MS = 600
/** Hard cap on the window handed to the recognizer (whisper's field of view
 * is 30 s; staying well below keeps each round trip around a second). */
export const MAX_WINDOW_MS = 20_000
/** Tail guard: segments ending closer than this to the window end stay partial. */
export const SAFETY_MARGIN_MS = 800
/** Longest boundary overlap removed when appending a committed span. */
const MAX_OVERLAP_CHARS = 24
/** Characters that carry no words, ignored when matching an overlap. */
const OVERLAP_IGNORABLE = /[\s,，。.;；:：!！?？、"'“”‘’()（）\-—…]/

function isOverlapIgnorable(char: string): boolean {
  return OVERLAP_IGNORABLE.test(char)
}

/** Punctuation- and space-free projection used for overlap comparison. */
function normalizeForOverlap(text: string): string {
  let out = ''
  for (const char of text) {
    if (!isOverlapIgnorable(char)) out += char
  }
  return out
}
/** A pause at least this long between two segments counts as a safe cut. */
export const MIN_GAP_MS = 120
/** Once the window is this long, commit the last finished segment even
 * without a pause behind it (holding the text back would stall the UI). */
export const FORCE_COMMIT_MS = 9000
/** Below this peak RMS a window is treated as silence (whisper hallucinates
 * whole sentences on silence — measured: a 5 s silent clip produced a full
 * unrelated Chinese sentence). */
export const SILENCE_RMS = 0.004

export interface StreamingSegment {
  /** Seconds from the start of the window. */
  start: number
  end: number
  text: string
}

export interface StreamingResult {
  text: string
  segments: StreamingSegment[]
}

export interface StreamingAsrOptions {
  /** Transcribe one PCM window. Rejections are reported, never thrown out. */
  transcribe: (pcm: Buffer, prompt: string) => Promise<StreamingResult>
  /** A committed span of text (word-aligned, never re-emitted). */
  onCommit: (text: string) => void
  /** The not-yet-committed tail of the current window. */
  onPartial: (text: string) => void
  /** Non-fatal failure; the next tick retries. */
  onError?: (message: string) => void
  /** Optional clock/byte accounting override for tests. */
  bytesPerSecond?: number
  minNewAudioMs?: number
  maxWindowMs?: number
  safetyMarginMs?: number
  silenceRms?: number
  /** RMS of a PCM16 buffer; injected so tests stay deterministic. */
  computeRms?: (pcm: Buffer) => number
}

export interface StreamingAsr {
  /** Buffer more 16 kHz mono PCM16 audio. */
  push(chunk: Buffer): void
  /** Run one recognition round if enough new audio is pending. */
  tick(): Promise<void>
  /** Flush the remaining buffer and commit everything (stop path). */
  finalize(): Promise<void>
  /** Drop buffered + committed state (clear path). */
  reset(): void
  /** Abort the in-flight request and drop state (cancel path). */
  cancel(): void
  /** Everything committed so far. */
  readonly committedText: string
  /** The current uncommitted tail. */
  readonly partialText: string
  /** Buffered-but-not-yet-committed duration in ms (diagnostics/tests). */
  readonly pendingMs: number
}

export function createStreamingAsr(options: StreamingAsrOptions): StreamingAsr {
  const bytesPerSecond = options.bytesPerSecond ?? PCM_BYTES_PER_SECOND
  const minNewAudioMs = options.minNewAudioMs ?? MIN_NEW_AUDIO_MS
  const maxWindowMs = options.maxWindowMs ?? MAX_WINDOW_MS
  const safetyMarginMs = options.safetyMarginMs ?? SAFETY_MARGIN_MS
  const silenceRms = options.silenceRms ?? SILENCE_RMS
  const computeRms = options.computeRms ?? rmsPcm16

  /** Audio not yet committed, starting at the current commit boundary. Kept
   * as a chunk LIST, not one Buffer: push runs ~125×/s and a per-push concat
   * would re-copy the whole (up to 20 s ≈ 640 KB) window every frame. The
   * list is flattened exactly where a contiguous buffer is required — the
   * RMS gate and the transcription call. */
  let chunks: Buffer[] = []
  let bufferBytes = 0
  /** Bytes of `buffer` that arrived since the last recognition round. */
  let unprocessedBytes = 0
  let committedText = ''
  let partialText = ''
  let inFlight = false
  let cancelled = false
  /** Set once finalize starts: its transcription is then the only commit path,
   * and an in-flight tick's response (same window!) must be discarded. */
  let finalized = false
  let currentAbort: AbortController | null = null

  const bytesToMs = (bytes: number): number => (bytes / bytesPerSecond) * 1000

  /** Contiguous window for RMS/transcribe; single chunks pass through free. */
  const flatten = (): Buffer =>
    chunks.length <= 1 ? (chunks[0] ?? Buffer.alloc(0)) : Buffer.concat(chunks)

  /** Drop `count` leading bytes (subarray views make head trims copy-free). */
  const dropBytes = (count: number): void => {
    let remaining = Math.min(count, bufferBytes)
    while (remaining > 0 && chunks.length > 0) {
      const head = chunks[0]
      if (head.length <= remaining) {
        chunks.shift()
        bufferBytes -= head.length
        remaining -= head.length
      } else {
        chunks[0] = head.subarray(remaining)
        bufferBytes -= remaining
        remaining = 0
      }
    }
  }

  /**
   * Append a committed span, removing the part that re-recognizes text we
   * already emitted.
   *
   * A window always re-decodes the audio around its left edge, so the next
   * result starts with words that are already committed. Comparison is done
   * on a punctuation-stripped projection: whisper punctuates the same words
   * differently from window to window ("看看。" vs "看看"), so a raw string
   * compare misses the overlap and duplicates the phrase.
   */
  const emitCommit = (text: string): void => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Only the tail of the transcript can overlap (≤ MAX_OVERLAP_CHARS
    // non-ignorable chars), so walk back just far enough to cover that —
    // normalizing the whole transcript is O(full length) on every commit.
    let collected = 0
    let start = committedText.length
    for (let i = committedText.length - 1; i >= 0 && collected < MAX_OVERLAP_CHARS; i--) {
      if (!isOverlapIgnorable(committedText[i])) collected++
      start = i
    }
    const seen = normalizeForOverlap(committedText.slice(start))
    const incoming = normalizeForOverlap(trimmed)
    // Longest suffix of what we emitted that equals a prefix of the new text.
    const maxOverlap = Math.min(seen.length, incoming.length, MAX_OVERLAP_CHARS)
    let matched = 0
    for (let size = maxOverlap; size > 0; size--) {
      if (seen.endsWith(incoming.slice(0, size))) {
        matched = size
        break
      }
    }

    // Map the matched character count back onto the raw text so the emitted
    // slice keeps whisper's own punctuation.
    let addition = trimmed
    if (matched > 0) {
      let consumed = 0
      let index = 0
      while (index < trimmed.length && consumed < matched) {
        if (!isOverlapIgnorable(trimmed[index])) consumed++
        index++
      }
      addition = trimmed.slice(index)
    }

    addition = addition.replace(/^[\s,，。.;；:：!！?？、]+/, '')
    if (!addition) return
    committedText += addition
    options.onCommit(addition)
  }

  const setPartial = (text: string): void => {
    const trimmed = text.trim()
    if (trimmed === partialText) return
    partialText = trimmed
    options.onPartial(trimmed)
  }

  /** Prompt = tail of committed text, giving the decoder left context. */
  const buildPrompt = (): string => committedText.slice(-200)

  /**
   * Commit the finished part of the window, then drop that audio so the next
   * window starts where this one ended.
   *
   * Cutting in the middle of a word is what makes streaming transcripts look
   * garbled: the next window re-decodes the fragment and guesses differently
   * ("确认时" + "间戳的边界" came back as "确认实际。编辑的编辑"). whisper's own
   * segment boundaries fall on pauses, so those are the safe cut points: a
   * segment is committed only when a real gap follows it (or it is the last
   * finished one and the buffer is long enough that waiting would stall the
   * transcript).
   */
  const commitSegments = (result: StreamingResult, windowMs: number): void => {
    const commitLimit = windowMs - safetyMarginMs
    if (commitLimit <= 0) {
      setPartial(result.text)
      return
    }

    const finished = result.segments.filter((segment) => segment.end * 1000 <= commitLimit)
    if (finished.length === 0) {
      // No finished span yet: keep the whole window as partial text and keep
      // the audio, otherwise the un-committed head would be lost.
      setPartial(result.text)
      return
    }

    // Prefer a segment followed by a pause — that boundary sits on silence,
    // so the next window starts cleanly. A segment qualifies as a cut point
    // when the recognizer reported no speech right after it:
    //   - another segment starts ≥ MIN_GAP_MS later, or
    //   - it is the LAST segment of the window and the window extends at
    //     least a safety margin past it (nothing was recognized after it).
    // A segment that is immediately followed by more speech never qualifies,
    // however finished it is: cutting there would split a phrase.
    let cutIndex = -1
    for (const segment of finished) {
      const next = result.segments.find((candidate) => candidate.start >= segment.end)
      if (!next) {
        if (windowMs - segment.end * 1000 >= safetyMarginMs) {
          cutIndex = result.segments.indexOf(segment)
        }
        continue
      }
      if ((next.start - segment.end) * 1000 >= MIN_GAP_MS) {
        cutIndex = result.segments.indexOf(segment)
      }
    }
    // Nothing ends on a pause: hold the text as partial rather than slice a
    // word, unless the window is long enough that holding back would stall.
    if (cutIndex < 0) {
      if (windowMs < FORCE_COMMIT_MS) {
        setPartial(result.text)
        return
      }
      cutIndex = result.segments.indexOf(finished[finished.length - 1])
    }

    const done = result.segments.slice(0, cutIndex + 1)
    for (const segment of done) emitCommit(segment.text)

    const consumedMs = Math.max(...done.map((segment) => segment.end * 1000))
    const consumedBytes = Math.min(bufferBytes, Math.round((consumedMs / 1000) * bytesPerSecond))
    dropBytes(consumedBytes)
    unprocessedBytes = Math.max(0, unprocessedBytes - consumedBytes)

    // The remainder of this window is the next window's partial text. Rebuild
    // it from the segments that were not committed so the UI never shows text
    // that the trim just dropped.
    const remaining = result.segments.filter((segment) => segment.end * 1000 > consumedMs)
    const tail = remaining
      .map((segment) => segment.text)
      .join('')
      .trim()
    // A recognizer may return one segment covering committed + uncommitted
    // audio; in that case fall back to the full text minus what we committed.
    const committed = done.map((segment) => segment.text).join('')
    const fallback = result.text.startsWith(committed) ? result.text.slice(committed.length) : ''
    setPartial(tail || fallback)
  }

  const runOnce = async (): Promise<void> => {
    if (cancelled || finalized) return
    const windowMs = bytesToMs(bufferBytes)
    if (windowMs <= 0) {
      setPartial('')
      return
    }

    // Contiguous view for the gate + the round trip (flatten is copy-free
    // unless several chunks are pending).
    const pcm = flatten()

    // Silence gate: skip the round trip entirely. Whisper invents sentences
    // on silent input, which is far worse than showing nothing.
    if (computeRms(pcm) < silenceRms) {
      unprocessedBytes = 0
      // Drop silent audio beyond the safety margin so a long silence cannot
      // grow the buffer to the window cap.
      if (windowMs > maxWindowMs) {
        const keepBytes = Math.round(((maxWindowMs - safetyMarginMs) / 1000) * bytesPerSecond)
        dropBytes(bufferBytes - keepBytes)
      }
      setPartial('')
      return
    }

    inFlight = true
    currentAbort = new AbortController()
    try {
      const result = await options.transcribe(pcm, buildPrompt())
      if (cancelled || finalized) return
      commitSegments(result, bytesToMs(bufferBytes))
    } catch (error) {
      if (!cancelled) {
        options.onError?.(error instanceof Error ? error.message : String(error))
      }
    } finally {
      inFlight = false
      currentAbort = null
    }
  }

  return {
    get committedText() {
      return committedText
    },
    get partialText() {
      return partialText
    },
    get pendingMs() {
      return bytesToMs(bufferBytes)
    },

    push(chunk) {
      if (cancelled || chunk.length === 0) return
      chunks.push(chunk)
      bufferBytes += chunk.length
      unprocessedBytes += chunk.length
    },

    async tick() {
      if (cancelled || inFlight) return
      // Not enough new audio to justify a round trip (and nothing pending to
      // commit). The step still runs so a long window gets trimmed.
      if (bytesToMs(unprocessedBytes) < minNewAudioMs && bytesToMs(bufferBytes) < maxWindowMs) {
        return
      }
      // Cap the window: keep the newest audio, commit what we can first.
      if (bytesToMs(bufferBytes) > maxWindowMs) {
        await runOnce()
        if (cancelled) return
        if (bytesToMs(bufferBytes) > maxWindowMs) {
          const keepBytes = Math.round((maxWindowMs / 1000) * bytesPerSecond)
          dropBytes(bufferBytes - keepBytes)
        }
      } else {
        await runOnce()
      }
      unprocessedBytes = 0
    },

    async finalize() {
      if (cancelled || finalized) return
      finalized = true
      const windowMs = bytesToMs(bufferBytes)
      if (windowMs <= 0) {
        setPartial('')
        return
      }

      // One last pass over what is left. On stop there is no next window, so
      // the safety margin protects nothing: every segment is committed. This
      // must be the ONLY transcription call in finalize — a preceding regular
      // tick would commit the same spans twice.
      try {
        const result = await options.transcribe(flatten(), buildPrompt())
        if (!cancelled) {
          if (result.segments.length > 0) {
            for (const segment of result.segments) emitCommit(segment.text)
          } else {
            emitCommit(result.text)
          }
        }
      } catch (error) {
        if (!cancelled) {
          options.onError?.(error instanceof Error ? error.message : String(error))
        }
      }
      chunks = []
      bufferBytes = 0
      unprocessedBytes = 0
      setPartial('')
    },

    reset() {
      chunks = []
      bufferBytes = 0
      unprocessedBytes = 0
      committedText = ''
      finalized = false
      setPartial('')
    },

    cancel() {
      cancelled = true
      currentAbort?.abort()
      chunks = []
      bufferBytes = 0
      unprocessedBytes = 0
      setPartial('')
    }
  }
}
