export type PresetId = 'beginner' | 'standard' | 'challenge' | 'custom'

export type ExerciseMode = 'missing-whole' | 'missing-part' | 'mixed'

export type MissingPosition = 'whole' | 'partA' | 'partB'

export type ZeroPolicy = 'allow' | 'exclude'

export type SessionLength = 5 | 10 | 20 | 'endless'

export type SessionDurationMinutes = 3 | 5 | 10 | 15

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
  /** `null` means no countdown; only endless sessions may use a duration. */
  sessionDurationMinutes: SessionDurationMinutes | null
  adaptive: boolean
  orientation: DiagramOrientation
}

export type RangeBand = '1-5' | '6-10' | '11-20'

export type ProblemType = 'missing-whole' | 'missing-part'

export interface MetricBucket {
  attempted: number
  solved: number
  firstTryCorrect: number
  hintsUsed: number
  reveals: number
  totalAttempts: number
  totalResponseMs: number
}

export interface SessionBreakdown {
  byRange: Record<RangeBand, MetricBucket>
  byType: Record<ProblemType, MetricBucket>
}

export type SessionEndReason = 'questions' | 'timer' | 'ended'

/** Aggregate session data only; individual answers are deliberately not stored. */
export interface SessionSummary {
  timestamp: string
  settings: PracticeSettings
  questionsCompleted: number
  firstAttemptCorrect: number
  points: number
  maxStreak: number
  durationSeconds: number
  highestWhole: number
  adaptiveLevelUps: number
  endReason: SessionEndReason
  breakdown: SessionBreakdown
}

export const PRESET_SETTINGS: Readonly<Record<PresetId, PracticeSettings>> = {
  beginner: {
    preset: 'beginner',
    minWhole: 1,
    maxWhole: 5,
    exerciseMode: 'missing-whole',
    zeroPolicy: 'allow',
    sessionLength: 10,
    sessionDurationMinutes: null,
    adaptive: true,
    orientation: 'whole-top',
  },
  standard: {
    preset: 'standard',
    minWhole: 1,
    maxWhole: 10,
    exerciseMode: 'mixed',
    zeroPolicy: 'allow',
    sessionLength: 10,
    sessionDurationMinutes: null,
    adaptive: true,
    orientation: 'whole-top',
  },
  challenge: {
    preset: 'challenge',
    minWhole: 1,
    maxWhole: 20,
    exerciseMode: 'mixed',
    zeroPolicy: 'allow',
    sessionLength: 10,
    sessionDurationMinutes: null,
    adaptive: true,
    orientation: 'whole-top',
  },
  custom: {
    preset: 'custom',
    minWhole: 1,
    maxWhole: 10,
    exerciseMode: 'mixed',
    zeroPolicy: 'allow',
    sessionLength: 10,
    sessionDurationMinutes: null,
    adaptive: true,
    orientation: 'whole-top',
  },
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  ...PRESET_SETTINGS.standard,
}
