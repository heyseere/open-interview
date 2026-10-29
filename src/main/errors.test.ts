import { describe, expect, it } from 'vitest'
import { classifyApiError, extractErrorMessage } from './errors'

// The fallback is caller-localized (tMain('err.unknown')); the tests use a
// fixed fixture so a changed translation can never break them.
const FALLBACK = 'Unknown error'

describe('extractErrorMessage', () => {
  it('stringifies non-Error values', () => {
    expect(extractErrorMessage(42, FALLBACK)).toBe('42')
    expect(extractErrorMessage(null, FALLBACK)).toBe(FALLBACK)
    expect(extractErrorMessage(undefined, FALLBACK)).toBe(FALLBACK)
    expect(extractErrorMessage('', FALLBACK)).toBe(FALLBACK)
  })

  it('falls back to error.message when no responseBody exists', () => {
    expect(extractErrorMessage(new Error('boom'), FALLBACK)).toBe('boom')
  })

  it('uses fallback when Error message is blank', () => {
    expect(extractErrorMessage(new Error(''), FALLBACK)).toBe(FALLBACK)
  })

  it('extracts top-level message from a JSON responseBody', () => {
    const error = Object.assign(new Error('HTTP error'), {
      responseBody: JSON.stringify({ message: 'Invalid API key' })
    })
    expect(extractErrorMessage(error, FALLBACK)).toBe('Invalid API key')
  })

  it('extracts nested error.message from a JSON responseBody', () => {
    const error = Object.assign(new Error('HTTP error'), {
      responseBody: JSON.stringify({ error: { message: 'Rate limit exceeded' } })
    })
    expect(extractErrorMessage(error, FALLBACK)).toBe('Rate limit exceeded')
  })

  it('returns short non-JSON responseBody as-is', () => {
    const error = Object.assign(new Error('HTTP error'), { responseBody: 'Service Unavailable' })
    expect(extractErrorMessage(error, FALLBACK)).toBe('Service Unavailable')
  })

  it('ignores long non-JSON responseBody and uses error.message instead', () => {
    const longBody = 'x'.repeat(200)
    const error = Object.assign(new Error('Request failed'), { responseBody: longBody })
    expect(extractErrorMessage(error, FALLBACK)).toBe('Request failed')
  })

  it('prefers top-level message over nested error.message', () => {
    const error = Object.assign(new Error('HTTP error'), {
      responseBody: JSON.stringify({ message: 'primary', error: { message: 'nested' } })
    })
    expect(extractErrorMessage(error, FALLBACK)).toBe('primary')
  })
})

describe('classifyApiError', () => {
  it('maps status codes before message heuristics', () => {
    const rateLimited = Object.assign(new Error('Request timed out'), { statusCode: 429 })
    expect(classifyApiError(rateLimited)).toBe('rate-limit')
    const authError = Object.assign(new Error('fetch failed'), { statusCode: 401 })
    expect(classifyApiError(authError)).toBe('auth')
  })

  it('maps auth, billing and rate-limit statuses', () => {
    expect(classifyApiError(Object.assign(new Error('x'), { statusCode: 403 }))).toBe('auth')
    expect(classifyApiError(Object.assign(new Error('x'), { statusCode: 402 }))).toBe('auth')
    expect(classifyApiError(Object.assign(new Error('x'), { statusCode: 429 }))).toBe('rate-limit')
  })

  it('maps 408 and 5xx statuses', () => {
    expect(classifyApiError(Object.assign(new Error('x'), { statusCode: 408 }))).toBe('timeout')
    expect(classifyApiError(Object.assign(new Error('x'), { statusCode: 503 }))).toBe('server')
    expect(classifyApiError(Object.assign(new Error('x'), { statusCode: 500 }))).toBe('server')
  })

  it('maps timeouts from the error name or message', () => {
    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    expect(classifyApiError(abort)).toBe('timeout')
    expect(classifyApiError(new Error('Request timed out after 20000ms'))).toBe('timeout')
  })

  it('maps network failures', () => {
    expect(classifyApiError(new Error('fetch failed'))).toBe('network')
    const dns = new Error('getaddrinfo ENOTFOUND api.example.com')
    expect(classifyApiError(dns)).toBe('network')
    expect(classifyApiError(new Error('connect ECONNREFUSED 127.0.0.1:11434'))).toBe('network')
  })

  it('keeps unlisted failures (e.g. 404 model missing) unknown for passthrough', () => {
    expect(classifyApiError(new Error('model "gpt-x" not found'))).toBe('unknown')
    expect(classifyApiError(Object.assign(new Error('x'), { statusCode: 404 }))).toBe('unknown')
    expect(classifyApiError('a string failure')).toBe('unknown')
  })
})
