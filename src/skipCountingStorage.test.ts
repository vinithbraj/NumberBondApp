import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  countingReducer,
  createCountingRound,
  summarizeCountingRound,
} from './domain/skipCounting'
import {
  COUNTING_STORAGE_KEY,
  loadCountingProgress,
  saveCountingProgress,
} from './skipCountingStorage'

describe('skip-counting storage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('persists settings and only the ten latest aggregate results', () => {
    const state = countingReducer(
      createCountingRound({ step: 3, timer: 120 }, 0),
      { type: 'reveal', now: 1000 },
    )
    const summary = summarizeCountingRound(state)
    saveCountingProgress({
      settings: { step: 3, timer: 120 },
      sessions: Array.from({ length: 12 }, () => summary),
    })
    expect(loadCountingProgress().settings).toEqual({ step: 3, timer: 120 })
    expect(loadCountingProgress().sessions).toHaveLength(10)
    expect(loadCountingProgress().sessions[0]).toEqual(summary)
  })

  it('recovers from malformed settings, corrupt data, and impossible results', () => {
    localStorage.setItem(COUNTING_STORAGE_KEY, '{broken')
    expect(loadCountingProgress()).toEqual({
      settings: { step: 5, timer: 0 },
      sessions: [],
    })
    localStorage.setItem(
      COUNTING_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: { step: 0, timer: -10 },
        sessions: [{ points: 999 }],
      }),
    )
    expect(loadCountingProgress()).toEqual({
      settings: { step: 5, timer: 0 },
      sessions: [],
    })
  })

  it('allows play if browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadCountingProgress().settings.step).toBe(5)
    expect(() => saveCountingProgress(loadCountingProgress())).not.toThrow()
  })
})
