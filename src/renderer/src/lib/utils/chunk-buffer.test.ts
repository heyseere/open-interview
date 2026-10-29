import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChunkBuffer } from './chunk-buffer'

describe('ChunkBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('delivers chunks after the delay window', () => {
    const onFlush = vi.fn()
    const buffer = new ChunkBuffer({ delayMs: 100, onFlush })

    buffer.push('a')
    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(onFlush).toHaveBeenCalledWith(['a'])
    expect(buffer.size).toBe(0)
  })

  it('coalesces many pushes within one window into a single flush', () => {
    const onFlush = vi.fn()
    const buffer = new ChunkBuffer({ delayMs: 100, onFlush })

    for (const ch of ['a', 'b', 'c']) buffer.push(ch)
    vi.advanceTimersByTime(100)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith(['a', 'b', 'c'])
  })

  it('starts a new window after each flush', () => {
    const onFlush = vi.fn()
    const buffer = new ChunkBuffer({ delayMs: 50, onFlush })

    buffer.push('1')
    vi.advanceTimersByTime(50)
    buffer.push('2')
    vi.advanceTimersByTime(50)

    expect(onFlush).toHaveBeenNthCalledWith(1, ['1'])
    expect(onFlush).toHaveBeenNthCalledWith(2, ['2'])
  })

  it('manual flush delivers immediately and cancels the timer', () => {
    const onFlush = vi.fn()
    const buffer = new ChunkBuffer({ delayMs: 100, onFlush })

    buffer.push('x')
    buffer.flush()
    expect(onFlush).toHaveBeenCalledWith(['x'])

    vi.advanceTimersByTime(500)
    expect(onFlush).toHaveBeenCalledTimes(1)
  })

  it('ignores empty pushes and empty flushes', () => {
    const onFlush = vi.fn()
    const buffer = new ChunkBuffer({ delayMs: 10, onFlush })

    buffer.push('')
    buffer.push('')
    vi.advanceTimersByTime(10)
    expect(onFlush).not.toHaveBeenCalled()

    buffer.flush()
    expect(onFlush).not.toHaveBeenCalled()
  })
})
