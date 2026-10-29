import { describe, expect, it } from 'vitest'
import { planStreamTail, planTurnEnd } from './stream-guard'

describe('planStreamTail', () => {
  it('flushes the tail and ends loading for a normal run', () => {
    expect(planStreamTail({ replaced: false, stale: false })).toEqual({
      flushTail: true,
      sendLoadingEnd: true
    })
  })

  it('flushes and ends loading after a user stop (no successor)', () => {
    // A user stop leaves the stream in place — the tail is the partial answer
    expect(planStreamTail({ replaced: false, stale: false })).toEqual({
      flushTail: true,
      sendLoadingEnd: true
    })
  })

  it('suppresses both when a successor stream took over', () => {
    expect(planStreamTail({ replaced: true, stale: true })).toEqual({
      flushTail: false,
      sendLoadingEnd: false
    })
  })

  it('drops the tail but still ends loading after a session reset (stale, no successor)', () => {
    expect(planStreamTail({ replaced: false, stale: true })).toEqual({
      flushTail: false,
      sendLoadingEnd: true
    })
  })
})

describe('planTurnEnd', () => {
  const clean = {
    stale: false,
    aborted: false,
    stoppedByUser: false,
    errored: false,
    errorSource: null,
    empty: false
  } as const

  it('commits and completes a clean non-empty stream', () => {
    expect(planTurnEnd(clean)).toEqual({
      ok: true,
      commit: true,
      sendError: false,
      errorSource: null,
      sendStopped: false,
      rollback: false
    })
  })

  it('is a silent no-op when a newer request owns the sequence (any state)', () => {
    for (const variant of [
      { ...clean, stale: true },
      { ...clean, stale: true, aborted: true, errored: true, errorSource: 'caught' as const },
      { ...clean, stale: true, empty: true }
    ]) {
      const plan = planTurnEnd(variant)
      expect(plan.ok).toBe(false)
      expect(plan.commit).toBe(false)
      expect(plan.sendError).toBe(false)
      expect(plan.sendStopped).toBe(false)
      expect(plan.rollback).toBe(false)
    }
  })

  it('emits solution-stopped only for a user-initiated stop', () => {
    expect(planTurnEnd({ ...clean, aborted: true, stoppedByUser: true }).sendStopped).toBe(true)
    const superseded = planTurnEnd({ ...clean, aborted: true, stoppedByUser: false })
    expect(superseded.sendStopped).toBe(false)
    expect(superseded.commit).toBe(false)
    expect(superseded.rollback).toBe(false)
  })

  it('reports an error and rolls back a failed stream', () => {
    const plan = planTurnEnd({ ...clean, errored: true, errorSource: 'caught' })
    expect(plan).toMatchObject({
      ok: false,
      commit: false,
      sendError: true,
      errorSource: 'caught',
      rollback: true
    })
    expect(planTurnEnd({ ...clean, errored: true, errorSource: 'stream' }).errorSource).toBe(
      'stream'
    )
  })

  it('treats a clean-but-empty stream as a failure and rolls it back', () => {
    const plan = planTurnEnd({ ...clean, empty: true })
    expect(plan).toMatchObject({
      ok: false,
      commit: false,
      sendError: true,
      errorSource: 'empty',
      rollback: true
    })
  })
})
