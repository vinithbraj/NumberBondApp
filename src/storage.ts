import {
  DEFAULT_SETTINGS,
  MAX_WHOLE,
  MIN_WHOLE,
} from './domain/types';
import type {
  DiagramOrientation,
  ExerciseMode,
  PracticeSettings,
  PresetId,
  SessionLength,
  SessionSummary,
  ZeroPolicy,
} from './domain/types';

export const STORAGE_VERSION = 1 as const;
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

/**
 * Copies only known fields as well as validating them. Besides guarding against
 * corrupt storage, this prevents accidental persistence of a child's name or
 * individual answers if a wider object is passed at runtime.
 */
function normalizeSettings(value: unknown): PracticeSettings | null {
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
    orientation: value.orientation,
  };
}

function defaultSettings(): PracticeSettings {
  // DEFAULT_SETTINGS is compile-time trusted, but copying it keeps callers from
  // mutating the shared default object through a returned state value.
  return { ...DEFAULT_SETTINGS };
}

function normalizeSummary(value: unknown): SessionSummary | null {
  if (
    !isRecord(value) ||
    typeof value.timestamp !== 'string' ||
    !Number.isFinite(Date.parse(value.timestamp)) ||
    !isNonNegativeInteger(value.questionsCompleted) ||
    !isNonNegativeInteger(value.firstAttemptCorrect) ||
    value.firstAttemptCorrect > value.questionsCompleted
  ) {
    return null;
  }

  const settings = normalizeSettings(value.settings);
  if (!settings) {
    return null;
  }

  return {
    timestamp: value.timestamp,
    settings,
    questionsCompleted: value.questionsCompleted,
    firstAttemptCorrect: value.firstAttemptCorrect,
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
  if (!isRecord(value) || value.version !== STORAGE_VERSION) {
    return freshState();
  }

  const settings = normalizeSettings(value.settings) ?? defaultSettings();
  const tutorialCompleted =
    typeof value.tutorialCompleted === 'boolean'
      ? value.tutorialCompleted
      : false;
  const sessions = Array.isArray(value.sessions)
    ? newestFirst(
        value.sessions
          .map(normalizeSummary)
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

function cloneState(state: AppStorageState): AppStorageState {
  return {
    settings: { ...state.settings },
    tutorialCompleted: state.tutorialCompleted,
    sessions: state.sessions.map((summary) => ({
      ...summary,
      settings: { ...summary.settings },
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
    return normalizePersistedState(JSON.parse(serialized) as unknown);
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
