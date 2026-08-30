import {
  DEFAULT_SETTINGS,
  MAX_WHOLE,
  MIN_WHOLE,
} from './domain/types';
import type {
  DiagramOrientation,
  ExerciseMode,
  MetricBucket,
  PracticeSettings,
  PresetId,
  ProblemType,
  RangeBand,
  SessionBreakdown,
  SessionDurationMinutes,
  SessionEndReason,
  SessionLength,
  SessionSummary,
  ZeroPolicy,
} from './domain/types';

export const STORAGE_VERSION = 2 as const;
export const STORAGE_KEY = 'number-bonds:app-state';
export const MAX_SESSION_SUMMARIES = 10;

export interface AppStorageState {
  settings: PracticeSettings;
  tutorialCompleted: boolean;
  /** Newest session first. */
  sessions: SessionSummary[];
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistedAppState extends AppStorageState {
  version: typeof STORAGE_VERSION;
}

const PRESET_IDS: readonly PresetId[] = [
  'beginner',
  'standard',
  'challenge',
  'custom',
];
const EXERCISE_MODES: readonly ExerciseMode[] = [
  'missing-whole',
  'missing-part',
  'mixed',
];
const ZERO_POLICIES: readonly ZeroPolicy[] = ['allow', 'exclude'];
const ORIENTATIONS: readonly DiagramOrientation[] = [
  'whole-top',
  'whole-bottom',
];
const SESSION_LENGTHS: readonly SessionLength[] = [5, 10, 20, 'endless'];
const SESSION_DURATIONS: readonly SessionDurationMinutes[] = [3, 5, 10, 15];
const SESSION_END_REASONS: readonly SessionEndReason[] = [
  'questions',
  'timer',
  'ended',
];
const RANGE_BANDS: readonly RangeBand[] = ['1-5', '6-10', '11-20'];
const PROBLEM_TYPES: readonly ProblemType[] = [
  'missing-whole',
  'missing-part',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMember<T extends string | number>(
  value: unknown,
  choices: readonly T[],
): value is T {
  return choices.some((choice) => choice === value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value >= 1;
}

function emptyMetricBucket(): MetricBucket {
  return {
    attempted: 0,
    solved: 0,
    firstTryCorrect: 0,
    hintsUsed: 0,
    reveals: 0,
    totalAttempts: 0,
    totalResponseMs: 0,
  };
}

function emptySessionBreakdown(): SessionBreakdown {
  return {
    byRange: {
      '1-5': emptyMetricBucket(),
      '6-10': emptyMetricBucket(),
      '11-20': emptyMetricBucket(),
    },
    byType: {
      'missing-whole': emptyMetricBucket(),
      'missing-part': emptyMetricBucket(),
    },
  };
}

/**
 * Reads the version-one setting fields and supplies the new version-two
 * defaults. This is kept separate from current validation so a corrupt v2
 * record cannot silently omit its new fields.
 */
function normalizeLegacySettings(value: unknown): PracticeSettings | null {
  if (
    !isRecord(value) ||
    !isMember(value.preset, PRESET_IDS) ||
    !isPositiveInteger(value.minWhole) ||
    !isPositiveInteger(value.maxWhole) ||
    value.minWhole < MIN_WHOLE ||
    value.maxWhole > MAX_WHOLE ||
    value.minWhole > value.maxWhole ||
    !isMember(value.exerciseMode, EXERCISE_MODES) ||
    !isMember(value.zeroPolicy, ZERO_POLICIES) ||
    !isMember(value.sessionLength, SESSION_LENGTHS) ||
    !isMember(value.orientation, ORIENTATIONS)
  ) {
    return null;
  }

  return {
    preset: value.preset,
    minWhole: value.minWhole,
    maxWhole: value.maxWhole,
    exerciseMode: value.exerciseMode,
    zeroPolicy: value.zeroPolicy,
    sessionLength: value.sessionLength,
    sessionDurationMinutes: null,
    adaptive: true,
    orientation: value.orientation,
  };
}

/**
 * Copies only known fields as well as validating them. Besides guarding against
 * corrupt storage, this prevents accidental persistence of a child's name or
 * individual answers if a wider object is passed at runtime.
 */
function normalizeSettings(value: unknown): PracticeSettings | null {
  const base = normalizeLegacySettings(value);
  if (
    !base ||
    !isRecord(value) ||
    typeof value.adaptive !== 'boolean' ||
    !(
      value.sessionDurationMinutes === null ||
      isMember(value.sessionDurationMinutes, SESSION_DURATIONS)
    ) ||
    (base.sessionLength !== 'endless' && value.sessionDurationMinutes !== null)
  ) {
    return null;
  }

  return {
    ...base,
    sessionDurationMinutes: value.sessionDurationMinutes,
    adaptive: value.adaptive,
  };
}

function defaultSettings(): PracticeSettings {
  // DEFAULT_SETTINGS is compile-time trusted, but copying it keeps callers from
  // mutating the shared default object through a returned state value.
  return { ...DEFAULT_SETTINGS };
}

function normalizeMetricBucket(value: unknown): MetricBucket | null {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.attempted) ||
    !isNonNegativeInteger(value.solved) ||
    !isNonNegativeInteger(value.firstTryCorrect) ||
    !isNonNegativeInteger(value.hintsUsed) ||
    !isNonNegativeInteger(value.reveals) ||
    !isNonNegativeInteger(value.totalAttempts) ||
    !isNonNegativeInteger(value.totalResponseMs) ||
    value.solved > value.attempted ||
    value.solved + value.reveals > value.attempted ||
    value.firstTryCorrect > value.solved ||
    value.hintsUsed > value.attempted ||
    value.reveals > value.attempted ||
    value.totalAttempts < value.attempted
  ) {
    return null;
  }

  return {
    attempted: value.attempted,
    solved: value.solved,
    firstTryCorrect: value.firstTryCorrect,
    hintsUsed: value.hintsUsed,
    reveals: value.reveals,
    totalAttempts: value.totalAttempts,
    totalResponseMs: value.totalResponseMs,
  };
}

function normalizeBreakdown(value: unknown): SessionBreakdown | null {
  if (!isRecord(value) || !isRecord(value.byRange) || !isRecord(value.byType)) {
    return null;
  }

  const rangeValues = value.byRange;
  const typeValues = value.byType;
  const byRange = Object.fromEntries(
    RANGE_BANDS.map((band) => [band, normalizeMetricBucket(rangeValues[band])]),
  ) as Record<RangeBand, MetricBucket | null>;
  const byType = Object.fromEntries(
    PROBLEM_TYPES.map((type) => [type, normalizeMetricBucket(typeValues[type])]),
  ) as Record<ProblemType, MetricBucket | null>;

  if (
    RANGE_BANDS.some((band) => byRange[band] === null) ||
    PROBLEM_TYPES.some((type) => byType[type] === null)
  ) {
    return null;
  }

  return {
    byRange: byRange as Record<RangeBand, MetricBucket>,
    byType: byType as Record<ProblemType, MetricBucket>,
  };
}

function sumMetricBuckets(buckets: readonly MetricBucket[]): MetricBucket {
  return buckets.reduce(
    (total, bucket) => ({
      attempted: total.attempted + bucket.attempted,
      solved: total.solved + bucket.solved,
      firstTryCorrect: total.firstTryCorrect + bucket.firstTryCorrect,
      hintsUsed: total.hintsUsed + bucket.hintsUsed,
      reveals: total.reveals + bucket.reveals,
      totalAttempts: total.totalAttempts + bucket.totalAttempts,
      totalResponseMs: total.totalResponseMs + bucket.totalResponseMs,
    }),
    emptyMetricBucket(),
  );
}

function hasConsistentBreakdown(
  breakdown: SessionBreakdown,
  questionsCompleted: number,
  firstAttemptCorrect: number,
): boolean {
  const rangeTotals = sumMetricBuckets(
    RANGE_BANDS.map((band) => breakdown.byRange[band]),
  );
  const typeTotals = sumMetricBuckets(
    PROBLEM_TYPES.map((type) => breakdown.byType[type]),
  );

  // Migrated v1 summaries have no detailed aggregates to cross-check.
  if (rangeTotals.attempted === 0 && typeTotals.attempted === 0) return true;

  return (
    Object.keys(rangeTotals).every(
      (key) =>
        rangeTotals[key as keyof MetricBucket] ===
        typeTotals[key as keyof MetricBucket],
    ) &&
    typeTotals.solved + typeTotals.reveals === questionsCompleted &&
    typeTotals.firstTryCorrect === firstAttemptCorrect
  );
}

function hasValidSummaryBasics(value: Record<string, unknown>): boolean {
  return (
    typeof value.timestamp === 'string' &&
    Number.isFinite(Date.parse(value.timestamp)) &&
    isNonNegativeInteger(value.questionsCompleted) &&
    isNonNegativeInteger(value.firstAttemptCorrect) &&
    value.firstAttemptCorrect <= value.questionsCompleted
  );
}

function normalizeLegacySummary(value: unknown): SessionSummary | null {
  if (!isRecord(value) || !hasValidSummaryBasics(value)) {
    return null;
  }

  const settings = normalizeLegacySettings(value.settings);
  if (!settings) {
    return null;
  }

  return {
    timestamp: value.timestamp as string,
    settings,
    questionsCompleted: value.questionsCompleted as number,
    firstAttemptCorrect: value.firstAttemptCorrect as number,
    points: 0,
    maxStreak: 0,
    durationSeconds: 0,
    highestWhole: 0,
    adaptiveLevelUps: 0,
    endReason: 'questions',
    breakdown: emptySessionBreakdown(),
  };
}

function normalizeSummary(value: unknown): SessionSummary | null {
  if (
    !isRecord(value) ||
    !hasValidSummaryBasics(value) ||
    !isNonNegativeInteger(value.points) ||
    !isNonNegativeInteger(value.maxStreak) ||
    value.maxStreak > (value.questionsCompleted as number) ||
    !isNonNegativeInteger(value.durationSeconds) ||
    !isNonNegativeInteger(value.highestWhole) ||
    value.highestWhole > MAX_WHOLE ||
    !isNonNegativeInteger(value.adaptiveLevelUps) ||
    !isMember(value.endReason, SESSION_END_REASONS)
  ) {
    return null;
  }

  const settings = normalizeSettings(value.settings);
  const breakdown = normalizeBreakdown(value.breakdown);
  if (
    !settings ||
    !breakdown ||
    !hasConsistentBreakdown(
      breakdown,
      value.questionsCompleted as number,
      value.firstAttemptCorrect as number,
    )
  ) {
    return null;
  }

  return {
    timestamp: value.timestamp as string,
    settings,
    questionsCompleted: value.questionsCompleted as number,
    firstAttemptCorrect: value.firstAttemptCorrect as number,
    points: value.points,
    maxStreak: value.maxStreak,
    durationSeconds: value.durationSeconds,
    highestWhole: value.highestWhole,
    adaptiveLevelUps: value.adaptiveLevelUps,
    endReason: value.endReason,
    breakdown,
  };
}

function newestFirst(summaries: SessionSummary[]): SessionSummary[] {
  return summaries
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, MAX_SESSION_SUMMARIES);
}

function freshState(): AppStorageState {
  return {
    settings: defaultSettings(),
    tutorialCompleted: false,
    sessions: [],
  };
}

function normalizePersistedState(value: unknown): AppStorageState {
  if (!isRecord(value)) {
    return freshState();
  }

  const isLegacy = value.version === 1;
  if (!isLegacy && value.version !== STORAGE_VERSION) {
    return freshState();
  }

  const settingsNormalizer = isLegacy
    ? normalizeLegacySettings
    : normalizeSettings;
  const summaryNormalizer = isLegacy
    ? normalizeLegacySummary
    : normalizeSummary;
  const settings = settingsNormalizer(value.settings) ?? defaultSettings();
  const tutorialCompleted =
    typeof value.tutorialCompleted === 'boolean'
      ? value.tutorialCompleted
      : false;
  const sessions = Array.isArray(value.sessions)
    ? newestFirst(
        value.sessions
          .map(summaryNormalizer)
          .filter((summary): summary is SessionSummary => summary !== null),
      )
    : [];

  return { settings, tutorialCompleted, sessions };
}

function browserStorage(): StorageAdapter | null {
  try {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : globalThis.localStorage;
  } catch {
    // localStorage access can throw in privacy-restricted browser contexts.
    return null;
  }
}

function cloneMetricBucket(bucket: MetricBucket): MetricBucket {
  return { ...bucket };
}

function cloneBreakdown(breakdown: SessionBreakdown): SessionBreakdown {
  return {
    byRange: {
      '1-5': cloneMetricBucket(breakdown.byRange['1-5']),
      '6-10': cloneMetricBucket(breakdown.byRange['6-10']),
      '11-20': cloneMetricBucket(breakdown.byRange['11-20']),
    },
    byType: {
      'missing-whole': cloneMetricBucket(breakdown.byType['missing-whole']),
      'missing-part': cloneMetricBucket(breakdown.byType['missing-part']),
    },
  };
}

function cloneState(state: AppStorageState): AppStorageState {
  return {
    settings: { ...state.settings },
    tutorialCompleted: state.tutorialCompleted,
    sessions: state.sessions.map((summary) => ({
      ...summary,
      settings: { ...summary.settings },
      breakdown: cloneBreakdown(summary.breakdown),
    })),
  };
}

export function loadAppState(
  storage: StorageAdapter | null = browserStorage(),
): AppStorageState {
  if (!storage) {
    return freshState();
  }

  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (serialized === null) {
      return freshState();
    }
    const parsed = JSON.parse(serialized) as unknown;
    const state = normalizePersistedState(parsed);

    // Upgrade a valid or partially salvageable version-one record in place.
    return isRecord(parsed) && parsed.version === 1
      ? persistState(state, storage)
      : state;
  } catch {
    return freshState();
  }
}

function persistState(
  state: AppStorageState,
  storage: StorageAdapter | null,
): AppStorageState {
  const safeState = cloneState(state);
  const persisted: PersistedAppState = {
    version: STORAGE_VERSION,
    ...safeState,
  };

  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Keep the app usable when storage is unavailable or full. The returned
    // value still lets React update its in-memory state for this visit.
  }

  return cloneState(safeState);
}

export function loadSettings(
  storage: StorageAdapter | null = browserStorage(),
): PracticeSettings {
  return loadAppState(storage).settings;
}

export function loadTutorialCompleted(
  storage: StorageAdapter | null = browserStorage(),
): boolean {
  return loadAppState(storage).tutorialCompleted;
}

export function loadSessionSummaries(
  storage: StorageAdapter | null = browserStorage(),
): SessionSummary[] {
  return loadAppState(storage).sessions;
}

export function saveSettings(
  settings: PracticeSettings,
  storage: StorageAdapter | null = browserStorage(),
): AppStorageState {
  const current = loadAppState(storage);
  const safeSettings = normalizeSettings(settings);
  return persistState(
    { ...current, settings: safeSettings ?? current.settings },
    storage,
  );
}

export function setTutorialCompleted(
  completed = true,
  storage: StorageAdapter | null = browserStorage(),
): AppStorageState {
  const current = loadAppState(storage);
  return persistState(
    {
      ...current,
      tutorialCompleted:
        typeof completed === 'boolean' ? completed : current.tutorialCompleted,
    },
    storage,
  );
}

export function addSessionSummary(
  summary: SessionSummary,
  storage: StorageAdapter | null = browserStorage(),
): AppStorageState {
  const current = loadAppState(storage);
  const safeSummary = normalizeSummary(summary);
  if (!safeSummary) {
    return current;
  }

  return persistState(
    {
      ...current,
      sessions: newestFirst([safeSummary, ...current.sessions]),
    },
    storage,
  );
}

/** Clears recent results while retaining settings and tutorial completion. */
export function clearProgress(
  storage: StorageAdapter | null = browserStorage(),
): AppStorageState {
  const current = loadAppState(storage);
  return persistState({ ...current, sessions: [] }, storage);
}
