export type PresetId = 'beginner' | 'standard' | 'challenge' | 'custom'

export type ExerciseMode = 'missing-whole' | 'missing-part' | 'mixed'

export type MissingPosition = 'whole' | 'partA' | 'partB'

export type ZeroPolicy = 'allow' | 'exclude'

export type SessionLength = 5 | 10 | 20 | 'endless'

export type DiagramOrientation = 'whole-top' | 'whole-bottom'

export const MIN_WHOLE = 1
export const MAX_WHOLE = 20

/** A complete number bond. `missing` describes which value the child supplies. */
export interface BondExercise {
  whole: number
  parts: [number, number]
  missing: MissingPosition
}

export interface PracticeSettings {
  preset: PresetId
  minWhole: number
  maxWhole: number
  exerciseMode: ExerciseMode
  zeroPolicy: ZeroPolicy
  sessionLength: SessionLength
  orientation: DiagramOrientation
}

/** Aggregate session data only; individual answers are deliberately not stored. */
export interface SessionSummary {
  timestamp: string
  settings: PracticeSettings
  questionsCompleted: number
  firstAttemptCorrect: number
}

export const PRESET_SETTINGS: Readonly<Record<PresetId, PracticeSettings>> = {
  beginner: {
    preset: 'beginner',
    minWhole: 1,
    maxWhole: 5,
    exerciseMode: 'missing-whole',
    zeroPolicy: 'allow',
    sessionLength: 10,
    orientation: 'whole-top',
  },
  standard: {
    preset: 'standard',
    minWhole: 1,
    maxWhole: 10,
    exerciseMode: 'mixed',
    zeroPolicy: 'allow',
    sessionLength: 10,
    orientation: 'whole-top',
  },
  challenge: {
    preset: 'challenge',
    minWhole: 1,
    maxWhole: 20,
    exerciseMode: 'mixed',
    zeroPolicy: 'allow',
    sessionLength: 10,
    orientation: 'whole-top',
  },
  custom: {
    preset: 'custom',
    minWhole: 1,
    maxWhole: 10,
    exerciseMode: 'mixed',
    zeroPolicy: 'allow',
    sessionLength: 10,
    orientation: 'whole-top',
  },
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  ...PRESET_SETTINGS.standard,
}
