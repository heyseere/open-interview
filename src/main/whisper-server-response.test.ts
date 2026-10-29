import { describe, expect, it } from 'vitest'
import { parseTranscriptionResponse } from './transcription-response'

describe('parseTranscriptionResponse', () => {
  it('reads verbose_json segments (float seconds, no offsets field)', () => {
    // Shape verified against whisper-server v1.9.2: segments carry
    // start/end in seconds, NOT the C API's millisecond `offsets`.
    const result = parseTranscriptionResponse({
      task: 'transcribe',
      language: 'chinese',
      duration: 6.75,
      text: '第一句。第二句。',
      segments: [
        { id: 0, start: 0, end: 3.9, text: '第一句。', tokens: [], words: [] },
        { id: 1, start: 3.9, end: 6.7, text: '第二句。', tokens: [], words: [] }
      ]
    })
    expect(result.text).toBe('第一句。第二句。')
    expect(result.segments).toEqual([
      { start: 0, end: 3.9, text: '第一句。' },
      { start: 3.9, end: 6.7, text: '第二句。' }
    ])
  })

  it('accepts the plain json shape (text only)', () => {
    expect(parseTranscriptionResponse({ text: 'hello' })).toEqual({ text: 'hello', segments: [] })
  })

  it('accepts an OpenAI-compatible { text } body', () => {
    expect(parseTranscriptionResponse({ text: '  hi  ' })).toEqual({ text: 'hi', segments: [] })
  })

  it('drops segments with missing or non-numeric timings', () => {
    const result = parseTranscriptionResponse({
      text: 'x',
      segments: [
        { start: 0, end: 1, text: 'keep' },
        { start: null, end: 2, text: 'drop-start' },
        { start: 1, text: 'drop-end' },
        { start: 1, end: 2, text: '' },
        { start: '1', end: '2', text: 'drop-strings' }
      ]
    })
    expect(result.segments).toEqual([{ start: 0, end: 1, text: 'keep' }])
  })

  it('survives malformed bodies', () => {
    expect(parseTranscriptionResponse(null)).toEqual({ text: '', segments: [] })
    expect(parseTranscriptionResponse('nope')).toEqual({ text: '', segments: [] })
    expect(parseTranscriptionResponse({ segments: 'not-an-array' })).toEqual({
      text: '',
      segments: []
    })
  })
})
