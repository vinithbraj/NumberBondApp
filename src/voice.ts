import { correctAnswer } from './domain/exerciseGenerator'
import type { BondExercise } from './domain/types'

export type VoiceTone = 'warm' | 'cheerful' | 'calm'

export interface VoicePreferences {
  enabled: boolean
  tone: VoiceTone
  /** `null` asks the browser to use its default installed voice. */
  voiceURI: string | null
}

export interface VoiceProsody {
  rate: number
  pitch: number
  volume: number
}

export interface VoiceStorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const VOICE_STORAGE_VERSION = 1 as const
export const VOICE_STORAGE_KEY = 'number-bonds:voice-preferences'

export const DEFAULT_VOICE_PREFERENCES: Readonly<VoicePreferences> = {
  enabled: true,
  tone: 'warm',
  voiceURI: null,
}

/**
 * Browser speech engines vary, so tones use small, broadly supported prosody
 * changes instead of relying on a particular operating-system voice.
 */
export const VOICE_TONE_PROSODY: Readonly<
  Record<VoiceTone, Readonly<VoiceProsody>>
> = {
  warm: { rate: 0.9, pitch: 1.05, volume: 1 },
  cheerful: { rate: 1, pitch: 1.18, volume: 1 },
  calm: { rate: 0.82, pitch: 0.95, volume: 0.95 },
}

interface PersistedVoicePreferences {
  version: typeof VOICE_STORAGE_VERSION
  preferences: VoicePreferences
}

const VOICE_TONES: readonly VoiceTone[] = ['warm', 'cheerful', 'calm']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVoiceTone(value: unknown): value is VoiceTone {
  return VOICE_TONES.some((tone) => tone === value)
}

function normalizeVoiceURI(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeVoicePreferences(value: unknown): VoicePreferences | null {
  if (
    !isRecord(value) ||
    typeof value.enabled !== 'boolean' ||
    !isVoiceTone(value.tone)
  ) {
    return null
  }

  const voiceURI = normalizeVoiceURI(value.voiceURI)
  if (voiceURI === undefined) return null

  return {
    enabled: value.enabled,
    tone: value.tone,
    voiceURI,
  }
}

function freshVoicePreferences(): VoicePreferences {
  return { ...DEFAULT_VOICE_PREFERENCES }
}

function browserStorage(): VoiceStorageAdapter | null {
  try {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : globalThis.localStorage
  } catch {
    // Some privacy modes expose localStorage but throw when it is accessed.
    return null
  }
}

export function loadVoicePreferences(
  storage: VoiceStorageAdapter | null = browserStorage(),
): VoicePreferences {
  if (!storage) return freshVoicePreferences()

  try {
    const serialized = storage.getItem(VOICE_STORAGE_KEY)
    if (serialized === null) return freshVoicePreferences()

    const persisted = JSON.parse(serialized) as unknown
    if (
      !isRecord(persisted) ||
      persisted.version !== VOICE_STORAGE_VERSION
    ) {
      return freshVoicePreferences()
    }

    return (
      normalizeVoicePreferences(persisted.preferences) ??
      freshVoicePreferences()
    )
  } catch {
    return freshVoicePreferences()
  }
}

export function saveVoicePreferences(
  preferences: VoicePreferences,
  storage: VoiceStorageAdapter | null = browserStorage(),
): VoicePreferences {
  const normalized = normalizeVoicePreferences(preferences)
  if (!normalized) return loadVoicePreferences(storage)

  const persisted: PersistedVoicePreferences = {
    version: VOICE_STORAGE_VERSION,
    preferences: normalized,
  }

  try {
    storage?.setItem(VOICE_STORAGE_KEY, JSON.stringify(persisted))
  } catch {
    // Speech remains usable with in-memory preferences if storage is blocked.
  }

  return { ...normalized }
}

/** Teacher-like questions rotate predictably so sessions feel conversational. */
export function questionPromptFor(
  exercise: BondExercise,
  variantSeed = 0,
): string {
  const variant = Number.isFinite(variantSeed)
    ? Math.abs(Math.trunc(variantSeed)) % 3
    : 0

  if (exercise.missing === 'whole') {
    const [partA, partB] = exercise.parts
    return [
      `Okay, now find the whole. What do ${partA} and ${partB} make altogether?`,
      `Let's work out the whole. Put ${partA} and ${partB} together. What number do they make?`,
      `Your turn to find the whole. ${partA} and ${partB} make what number?`,
    ][variant]!
  }

  const visiblePart =
    exercise.missing === 'partA' ? exercise.parts[1] : exercise.parts[0]
  return [
    `Let's find the missing part. What number goes with ${visiblePart} to make ${exercise.whole}?`,
    `Find the part that's hiding. ${exercise.whole} is the whole and ${visiblePart} is one part. What is the other part?`,
    `Can you complete the number bond? What goes with ${visiblePart} to make ${exercise.whole}?`,
  ][variant]!
}

/** Positive feedback that repeats the complete bond to reinforce the fact. */
export function correctFeedbackFor(exercise: BondExercise): string {
  return `That's right! ${exercise.parts[0]} and ${exercise.parts[1]} make ${exercise.whole}. Great thinking!`
}

/**
 * Attempt numbers are one-based. After attempt two the matching UI reveals its
 * counting hint; after attempt three it can offer the answer without pressure.
 */
export function incorrectFeedbackFor(attempt: number): string {
  if (attempt === 2) {
    return "Let's use the counting dots for a hint. Count the groups, then try again."
  }
  if (Number.isFinite(attempt) && attempt >= 3) {
    return "This one is tricky. Try once more, or choose Show answer and we'll learn it together."
  }
  return 'Good try. Take another look and try again.'
}

/** Gentle explanation used after the child chooses to reveal an answer. */
export function revealedAnswerFeedbackFor(exercise: BondExercise): string {
  const missingKind = exercise.missing === 'whole' ? 'whole' : 'part'
  return `The missing ${missingKind} is ${correctAnswer(exercise)}. ${exercise.parts[0]} and ${exercise.parts[1]} make ${exercise.whole}. Let's try another one.`
}
