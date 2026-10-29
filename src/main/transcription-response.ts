/**
 * Pure response parsing for the local ASR server (no Electron, no network).
 *
 * Kept in its own module so the shape handling stays unit-testable: importing
 * whisper-server.ts pulls in Electron IPC registration as a side effect.
 */

/** One transcribed span, in seconds from the start of the submitted window. */
export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionWindowResult {
  text: string
  segments: TranscriptionSegment[]
}

interface RawSegment {
  start?: unknown
  end?: unknown
  text?: unknown
}

/**
 * Normalize one `/inference` response body.
 *
 * whisper-server answers `response_format=json` with `{ text }` and
 * `verbose_json` with `{ text, segments: [{ start, end, text }] }` where the
 * timings are FLOAT SECONDS (verified against v1.9.2 — there is no `offsets`
 * field, unlike the C API). OpenAI-compatible servers return `{ text }` too,
 * so the same parser covers both shapes.
 */
export function parseTranscriptionResponse(body: unknown): TranscriptionWindowResult {
  if (!body || typeof body !== 'object') return { text: '', segments: [] }
  const record = body as { text?: unknown; segments?: unknown }
  const text = typeof record.text === 'string' ? record.text.trim() : ''

  const rawSegments = Array.isArray(record.segments) ? (record.segments as RawSegment[]) : []
  const segments: TranscriptionSegment[] = []
  for (const raw of rawSegments) {
    const start = typeof raw.start === 'number' ? raw.start : null
    const end = typeof raw.end === 'number' ? raw.end : null
    const segText = typeof raw.text === 'string' ? raw.text.trim() : ''
    if (start === null || end === null || !segText) continue
    segments.push({ start, end, text: segText })
  }
  return { text, segments }
}
