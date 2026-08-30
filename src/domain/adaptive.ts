import {
  buildExercisePool,
  exerciseKey,
  isZeroBond,
  type RandomSource,
} from './exerciseGenerator'
import type { ScoringOutcome } from './scoring'
import {
  MAX_WHOLE,
  MIN_WHOLE,
  type BondExercise,
  type ExerciseMode,
  type PracticeSettings,
} from './types'

/** Allows this module to be used while older persisted settings are upgraded. */
export type AdaptivePracticeSettings = PracticeSettings & {
  adaptive?: boolean
}

export interface AdaptiveState {
  /** Lowest question ceiling this session may return to. */
  startingMax: number
  /** Inclusive upper bound used to generate the next question. */
  currentMax: number
  consecutiveFirstTry: number
  consecutiveAssisted: number
  /** Number of mixed-mode questions already selected. */
  mixedQuestionIndex: number
}

export interface AdaptiveExerciseSelection {
  exercise: BondExercise | undefined
  state: AdaptiveState
}

function clampedInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, Math.floor(value)))
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function sanitizedRange(settings: AdaptivePracticeSettings): [number, number] {
  const first = clampedInteger(settings.minWhole, MIN_WHOLE, MAX_WHOLE)
  const second = clampedInteger(settings.maxWhole, MIN_WHOLE, MAX_WHOLE)
  return first <= second ? [first, second] : [second, first]
}

function initialCeiling(settings: AdaptivePracticeSettings): number {
  const [minimum, maximum] = sanitizedRange(settings)
  if (settings.adaptive === false) return maximum

  // An inclusive five-number band is broad enough for variety while keeping a
  // new kindergarten learner's first questions approachable.
  return Math.min(maximum, minimum + 4)
}

export function createAdaptiveState(
  settings: AdaptivePracticeSettings,
): AdaptiveState {
  const startingMax = initialCeiling(settings)
  return {
    startingMax,
    currentMax: startingMax,
    consecutiveFirstTry: 0,
    consecutiveAssisted: 0,
    mixedQuestionIndex: 0,
  }
}

function normalizedState(
  state: AdaptiveState,
  settings: AdaptivePracticeSettings,
): AdaptiveState {
  const [, configuredMax] = sanitizedRange(settings)
  const startingMax = initialCeiling(settings)

  return {
    startingMax,
    currentMax: clampedInteger(
      state.currentMax,
      startingMax,
      configuredMax,
    ),
    consecutiveFirstTry: nonNegativeInteger(state.consecutiveFirstTry),
    consecutiveAssisted: nonNegativeInteger(state.consecutiveAssisted),
    mixedQuestionIndex: nonNegativeInteger(state.mixedQuestionIndex),
  }
}

/**
 * Move the numeric ceiling slowly: three consecutive first-try solves raise it
 * by at most two, while two assisted outcomes lower it by only one. A retry or
 * revealed answer is considered assisted; points are never involved here.
 */
export function recordAdaptiveOutcome(
  state: AdaptiveState,
  settings: AdaptivePracticeSettings,
  outcome: ScoringOutcome,
): AdaptiveState {
  const current = normalizedState(state, settings)
  if (settings.adaptive === false) {
    return {
      ...current,
      consecutiveFirstTry: 0,
      consecutiveAssisted: 0,
    }
  }

  const [, configuredMax] = sanitizedRange(settings)
  const firstTry = !outcome.revealed && outcome.attemptNumber === 1

  if (firstTry) {
    const consecutiveFirstTry = current.consecutiveFirstTry + 1
    if (consecutiveFirstTry < 3) {
      return {
        ...current,
        consecutiveFirstTry,
        consecutiveAssisted: 0,
      }
    }

    return {
      ...current,
      currentMax: Math.min(configuredMax, current.currentMax + 2),
      consecutiveFirstTry: 0,
      consecutiveAssisted: 0,
    }
  }

  const consecutiveAssisted = current.consecutiveAssisted + 1
  if (consecutiveAssisted < 2) {
    return {
      ...current,
      consecutiveFirstTry: 0,
      consecutiveAssisted,
    }
  }

  return {
    ...current,
    currentMax: Math.max(current.startingMax, current.currentMax - 1),
    consecutiveFirstTry: 0,
    consecutiveAssisted: 0,
  }
}

function randomIndex(length: number, random: RandomSource): number {
  if (length <= 1) return 0
  const value = random()
  if (!Number.isFinite(value)) return 0
  return Math.min(length - 1, Math.max(0, Math.floor(value * length)))
}

function modeForNextQuestion(
  configuredMode: ExerciseMode,
  mixedQuestionIndex: number,
): ExerciseMode {
  if (configuredMode !== 'mixed') return configuredMode
  return mixedQuestionIndex % 2 === 0 ? 'missing-whole' : 'missing-part'
}

function compatibleCandidates(
  pool: readonly BondExercise[],
  previous: BondExercise | undefined,
): readonly BondExercise[] {
  if (!previous) return pool

  const previousKey = exerciseKey(previous)
  const avoidsBoth = pool.filter(
    (exercise) =>
      exerciseKey(exercise) !== previousKey &&
      !(isZeroBond(previous) && isZeroBond(exercise)),
  )
  if (avoidsBoth.length > 0) return avoidsBoth

  if (isZeroBond(previous)) {
    const nonZero = pool.filter((exercise) => !isZeroBond(exercise))
    if (nonZero.length > 0) return nonZero
  }

  const nonDuplicates = pool.filter(
    (exercise) => exerciseKey(exercise) !== previousKey,
  )
  return nonDuplicates.length > 0 ? nonDuplicates : pool
}

/**
 * Select one valid question from the state's current range. Mixed mode starts
 * with a missing whole, then strictly alternates part/whole. Selection avoids
 * equivalent repeats and back-to-back zero bonds whenever the pool permits.
 */
export function selectNextAdaptiveExercise(
  settings: AdaptivePracticeSettings,
  state: AdaptiveState,
  previous?: BondExercise,
  random: RandomSource = Math.random,
): AdaptiveExerciseSelection {
  const current = normalizedState(state, settings)
  const [minimum] = sanitizedRange(settings)
  const mode = modeForNextQuestion(
    settings.exerciseMode,
    current.mixedQuestionIndex,
  )
  const pool = buildExercisePool({
    ...settings,
    minWhole: minimum,
    maxWhole: current.currentMax,
    exerciseMode: mode,
  })
  const candidates = compatibleCandidates(pool, previous)
  const exercise = candidates[randomIndex(candidates.length, random)]

  return {
    exercise,
    state:
      exercise && settings.exerciseMode === 'mixed'
        ? {
            ...current,
            mixedQuestionIndex: current.mixedQuestionIndex + 1,
          }
        : current,
  }
}
