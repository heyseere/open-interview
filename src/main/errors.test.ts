import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from './errors'

describe('extractErrorMessage', () => {
  it('stringifies non-Error values', () => {
    expect(extractErrorMessage(42)).toBe('42')
    expect(extractErrorMessage(null)).toBe('未知错误')
    expect(extractErrorMessage(undefined)).toBe('未知错误')
    expect(extractErrorMessage('')).toBe('未知错误')
  })

  it('falls back to error.message when no responseBody exists', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('uses empty-message fallback when Error message is blank', () => {
    expect(extractErrorMessage(new Error(''))).toBe('未知错误')
  })

  it('extracts top-level message from a JSON responseBody', () => {
    const error = Object.assign(new Error('HTTP error'), {
      responseBody: JSON.stringify({ message: 'Invalid API key' })
    })
    expect(extractErrorMessage(error)).toBe('Invalid API key')
  })

  it('extracts nested error.message from a JSON responseBody', () => {
    const error = Object.assign(new Error('HTTP error'), {
      responseBody: JSON.stringify({ error: { message: 'Rate limit exceeded' } })
    })
    expect(extractErrorMessage(error)).toBe('Rate limit exceeded')
  })

  it('returns short non-JSON responseBody as-is', () => {
    const error = Object.assign(new Error('HTTP error'), { responseBody: 'Service Unavailable' })
    expect(extractErrorMessage(error)).toBe('Service Unavailable')
  })

  it('ignores long non-JSON responseBody and uses error.message instead', () => {
    const longBody = 'x'.repeat(200)
    const error = Object.assign(new Error('Request failed'), { responseBody: longBody })
    expect(extractErrorMessage(error)).toBe('Request failed')
  })

  it('prefers top-level message over nested error.message', () => {
    const error = Object.assign(new Error('HTTP error'), {
      responseBody: JSON.stringify({ message: 'primary', error: { message: 'nested' } })
    })
    expect(extractErrorMessage(error)).toBe('primary')
  })
})
