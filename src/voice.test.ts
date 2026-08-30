// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import type { BondExercise } from './domain/types'
import {
  DEFAULT_VOICE_PREFERENCES,
  VOICE_STORAGE_KEY,
  VOICE_STORAGE_VERSION,
  VOICE_TONE_PROSODY,
  correctFeedbackFor,
  incorrectFeedbackFor,
  loadVoicePreferences,
  questionPromptFor,
  revealedAnswerFeedbackFor,
  saveVoicePreferences,
} from './voice'
import type { VoicePreferences, VoiceStorageAdapter } from './voice'

const WHOLE_MISSING: BondExercise = {
  whole: 7,
  parts: [2, 5],
  missing: 'whole',
}

const PART_A_MISSING: BondExercise = {
  whole: 7,
  parts: [2, 5],
  missing: 'partA',
}

const PART_B_MISSING: BondExercise = {
  whole: 7,
  parts: [2, 5],
  missing: 'partB',
}

describe('voice preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts enabled with a warm tone and the browser-default voice', () => {
    const first = loadVoicePreferences()
    const second = loadVoicePreferences()

    expect(first).toEqual({
      enabled: true,
      tone: 'warm',
      voiceURI: null,
    })
    expect(first).toEqual(DEFAULT_VOICE_PREFERENCES)
    expect(localStorage.getItem(VOICE_STORAGE_KEY)).toBeNull()

    first.enabled = false
    expect(second).toEqual(DEFAULT_VOICE_PREFERENCES)
  })

  it.each([
    { enabled: true, tone: 'cheerful', voiceURI: 'Samantha' },
    { enabled: false, tone: 'calm', voiceURI: null },
    { enabled: true, tone: 'warm', voiceURI: 'Alex' },
  ] satisfies VoicePreferences[])('round-trips %#', (preferences) => {
    expect(saveVoicePreferences(preferences)).toEqual(preferences)
    expect(loadVoicePreferences()).toEqual(preferences)

    expect(JSON.parse(localStorage.getItem(VOICE_STORAGE_KEY)!)).toEqual({
      version: VOICE_STORAGE_VERSION,
      preferences,
    })
  })

  it('normalizes an empty selected voice to the browser default', () => {
    const saved = saveVoicePreferences({
      enabled: true,
      tone: 'warm',
      voiceURI: '   ',
    })

    expect(saved.voiceURI).toBeNull()
    expect(loadVoicePreferences().voiceURI).toBeNull()
  })

  it('falls back safely for malformed JSON, old versions, and invalid fields', () => {
    localStorage.setItem(VOICE_STORAGE_KEY, '{bad json')
    expect(loadVoicePreferences()).toEqual(DEFAULT_VOICE_PREFERENCES)

    localStorage.setItem(
      VOICE_STORAGE_KEY,
      JSON.stringify({
        version: VOICE_STORAGE_VERSION + 1,
        preferences: { enabled: false, tone: 'calm', voiceURI: null },
      }),
    )
    expect(loadVoicePreferences()).toEqual(DEFAULT_VOICE_PREFERENCES)

    for (const preferences of [
      { enabled: 'yes', tone: 'warm', voiceURI: null },
      { enabled: true, tone: 'excited', voiceURI: null },
      { enabled: true, tone: 'warm', voiceURI: 42 },
    ]) {
      localStorage.setItem(
        VOICE_STORAGE_KEY,
        JSON.stringify({ version: VOICE_STORAGE_VERSION, preferences }),
      )
      expect(loadVoicePreferences()).toEqual(DEFAULT_VOICE_PREFERENCES)
    }
  })

  it('does not persist extra fields and ignores invalid runtime writes', () => {
    const safe: VoicePreferences = {
      enabled: false,
      tone: 'calm',
      voiceURI: 'A local voice',
    }
    saveVoicePreferences({ ...safe, childName: 'Not stored' } as VoicePreferences)

    expect(
      Object.keys(
        JSON.parse(localStorage.getItem(VOICE_STORAGE_KEY)!).preferences as object,
      ).sort(),
    ).toEqual(['enabled', 'tone', 'voiceURI'])

    expect(
      saveVoicePreferences(
        { ...safe, tone: 'unknown' } as unknown as VoicePreferences,
      ),
    ).toEqual(safe)
    expect(loadVoicePreferences()).toEqual(safe)
  })

  it('stays usable when storage is missing, blocked, or full', () => {
    const unavailableStorage: VoiceStorageAdapter = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('full')
      },
    }
    const preferences: VoicePreferences = {
      enabled: false,
      tone: 'cheerful',
      voiceURI: null,
    }

    expect(loadVoicePreferences(null)).toEqual(DEFAULT_VOICE_PREFERENCES)
    expect(loadVoicePreferences(unavailableStorage)).toEqual(
      DEFAULT_VOICE_PREFERENCES,
    )
    expect(saveVoicePreferences(preferences, unavailableStorage)).toEqual(
      preferences,
    )
  })
})

describe('voice tone prosody', () => {
  it('provides safe and distinct browser speech settings for every tone', () => {
    expect(Object.keys(VOICE_TONE_PROSODY).sort()).toEqual([
      'calm',
      'cheerful',
      'warm',
    ])

    const combinations = new Set<string>()
    for (const prosody of Object.values(VOICE_TONE_PROSODY)) {
      expect(prosody.rate).toBeGreaterThanOrEqual(0.1)
      expect(prosody.rate).toBeLessThanOrEqual(10)
      expect(prosody.pitch).toBeGreaterThanOrEqual(0)
      expect(prosody.pitch).toBeLessThanOrEqual(2)
      expect(prosody.volume).toBeGreaterThanOrEqual(0)
      expect(prosody.volume).toBeLessThanOrEqual(1)
      combinations.add(`${prosody.rate}:${prosody.pitch}:${prosody.volume}`)
    }
    expect(combinations.size).toBe(3)
  })
})

describe('teacher prompts', () => {
  it('asks for a missing whole using both visible parts', () => {
    expect(questionPromptFor(WHOLE_MISSING)).toBe(
      'Okay, now find the whole. What do 2 and 5 make altogether?',
    )
  })

  it('asks for either missing part using only the visible part and whole', () => {
    expect(questionPromptFor(PART_A_MISSING)).toBe(
      "Let's find the missing part. What number goes with 5 to make 7?",
    )
    expect(questionPromptFor(PART_B_MISSING)).toBe(
      "Let's find the missing part. What number goes with 2 to make 7?",
    )
  })

  it('rotates through several teacher-like question styles', () => {
    const wholePrompts = [0, 1, 2].map((variant) =>
      questionPromptFor(WHOLE_MISSING, variant),
    )
    const partPrompts = [0, 1, 2].map((variant) =>
      questionPromptFor(PART_A_MISSING, variant),
    )

    expect(new Set(wholePrompts).size).toBe(3)
    expect(new Set(partPrompts).size).toBe(3)
    expect(questionPromptFor(WHOLE_MISSING, Number.NaN)).toBe(wholePrompts[0])
  })

  it('gives positive feedback and repeats the complete bond', () => {
    expect(correctFeedbackFor(PART_A_MISSING)).toBe(
      "That's right! 2 and 5 make 7. Great thinking!",
    )
  })

  it('uses increasingly helpful, pressure-free feedback by attempt', () => {
    expect(incorrectFeedbackFor(1)).toBe(
      'Good try. Take another look and try again.',
    )
    expect(incorrectFeedbackFor(2)).toContain('counting dots for a hint')
    expect(incorrectFeedbackFor(3)).toContain('choose Show answer')
    expect(incorrectFeedbackFor(99)).toBe(incorrectFeedbackFor(3))
    expect(incorrectFeedbackFor(0)).toBe(incorrectFeedbackFor(1))
    expect(incorrectFeedbackFor(Number.NaN)).toBe(incorrectFeedbackFor(1))
  })

  it.each([
    [WHOLE_MISSING, 'The missing whole is 7.'],
    [PART_A_MISSING, 'The missing part is 2.'],
    [PART_B_MISSING, 'The missing part is 5.'],
  ] as const)('explains a revealed answer for %#', (exercise, opening) => {
    const feedback = revealedAnswerFeedbackFor(exercise)
    expect(feedback).toBe(
      `${opening} 2 and 5 make 7. Let's try another one.`,
    )
  })
})
