// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './domain/types';
import type {
  MetricBucket,
  PracticeSettings,
  SessionBreakdown,
  SessionSummary,
} from './domain/types';
import {
  MAX_SESSION_SUMMARIES,
  STORAGE_KEY,
  STORAGE_VERSION,
  addSessionSummary,
  clearProgress,
  loadAppState,
  loadSessionSummaries,
  loadSettings,
  loadTutorialCompleted,
  saveSettings,
  setTutorialCompleted,
} from './storage';
import type { StorageAdapter } from './storage';

const CUSTOM_SETTINGS: PracticeSettings = {
  preset: 'custom',
  minWhole: 3,
  maxWhole: 14,
  exerciseMode: 'missing-part',
  zeroPolicy: 'exclude',
  sessionLength: 20,
  sessionDurationMinutes: null,
  adaptive: false,
  orientation: 'whole-bottom',
};

function bucket(overrides: Partial<MetricBucket> = {}): MetricBucket {
  return {
    attempted: 0,
    solved: 0,
    firstTryCorrect: 0,
    hintsUsed: 0,
    reveals: 0,
    totalAttempts: 0,
    totalResponseMs: 0,
    ...overrides,
  };
}

function breakdown(): SessionBreakdown {
  return {
    byRange: {
      '1-5': bucket({
        attempted: 4,
        solved: 4,
        firstTryCorrect: 3,
        hintsUsed: 1,
        totalAttempts: 5,
        totalResponseMs: 12_000,
      }),
      '6-10': bucket({
        attempted: 6,
        solved: 6,
        firstTryCorrect: 5,
        totalAttempts: 7,
        totalResponseMs: 20_000,
      }),
      '11-20': bucket(),
    },
    byType: {
      'missing-whole': bucket({
        attempted: 5,
        solved: 5,
        firstTryCorrect: 4,
        hintsUsed: 1,
        totalAttempts: 6,
        totalResponseMs: 15_000,
      }),
      'missing-part': bucket({
        attempted: 5,
        solved: 5,
        firstTryCorrect: 4,
        totalAttempts: 6,
        totalResponseMs: 17_000,
      }),
    },
  };
}

function summary(
  day: number,
  overrides: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    timestamp: new Date(Date.UTC(2026, 0, day)).toISOString(),
    settings: { ...CUSTOM_SETTINGS },
    questionsCompleted: 10,
    firstAttemptCorrect: 8,
    points: 96,
    maxStreak: 5,
    durationSeconds: 185,
    highestWhole: 10,
    adaptiveLevelUps: 2,
    endReason: 'questions',
    breakdown: breakdown(),
    ...overrides,
  };
}

function legacySettings(): Record<string, unknown> {
  return {
    preset: CUSTOM_SETTINGS.preset,
    minWhole: CUSTOM_SETTINGS.minWhole,
    maxWhole: CUSTOM_SETTINGS.maxWhole,
    exerciseMode: CUSTOM_SETTINGS.exerciseMode,
    zeroPolicy: CUSTOM_SETTINGS.zeroPolicy,
    sessionLength: CUSTOM_SETTINGS.sessionLength,
    orientation: CUSTOM_SETTINGS.orientation,
  };
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns independent defaults when no state has been stored', () => {
    const first = loadAppState();
    const second = loadAppState();

    expect(first).toEqual({
      settings: DEFAULT_SETTINGS,
      tutorialCompleted: false,
      sessions: [],
    });

    first.settings.maxWhole = 999;
    expect(second.settings).toEqual(DEFAULT_SETTINGS);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('round-trips current settings and tutorial completion', () => {
    saveSettings(CUSTOM_SETTINGS);
    setTutorialCompleted();

    expect(loadSettings()).toEqual(CUSTOM_SETTINGS);
    expect(loadTutorialCompleted()).toBe(true);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      version: number;
      settings: PracticeSettings;
      tutorialCompleted: boolean;
    };
    expect(persisted.version).toBe(STORAGE_VERSION);
    expect(persisted.settings).toEqual(CUSTOM_SETTINGS);
    expect(persisted.tutorialCompleted).toBe(true);

    setTutorialCompleted(false);
    expect(loadTutorialCompleted()).toBe(false);
  });

  it('round-trips timed and unlimited endless-session settings', () => {
    const timed: PracticeSettings = {
      ...CUSTOM_SETTINGS,
      sessionLength: 'endless',
      sessionDurationMinutes: 5,
      adaptive: true,
    };
    saveSettings(timed);
    expect(loadSettings()).toEqual(timed);

    const unlimited: PracticeSettings = {
      ...timed,
      sessionDurationMinutes: null,
    };
    saveSettings(unlimited);
    expect(loadSettings()).toEqual(unlimited);
  });

  it('keeps only the 10 latest session summaries, newest first', () => {
    for (let day = 1; day <= 12; day += 1) {
      addSessionSummary(summary(day));
    }

    const sessions = loadSessionSummaries();
    expect(sessions).toHaveLength(MAX_SESSION_SUMMARIES);
    expect(sessions.map(({ timestamp }) => timestamp)).toEqual(
      Array.from({ length: 10 }, (_, index) => summary(12 - index).timestamp),
    );
    expect(sessions[0]).toEqual(summary(12));
    expect(sessions.at(-1)).toEqual(summary(3));
  });

  it('sorts and limits valid summaries found in storage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: DEFAULT_SETTINGS,
        tutorialCompleted: true,
        sessions: Array.from({ length: 12 }, (_, index) =>
          summary(index + 1),
        ).reverse(),
      }),
    );

    expect(loadSessionSummaries().map(({ timestamp }) => timestamp)).toEqual(
      Array.from({ length: 10 }, (_, index) => summary(12 - index).timestamp),
    );
  });

  it('clears progress while retaining adult settings and tutorial state', () => {
    saveSettings(CUSTOM_SETTINGS);
    setTutorialCompleted(true);
    addSessionSummary(summary(1));

    const cleared = clearProgress();

    expect(cleared).toEqual({
      settings: CUSTOM_SETTINGS,
      tutorialCompleted: true,
      sessions: [],
    });
    expect(loadAppState()).toEqual(cleared);
  });

  it('migrates version-one settings and summaries in place', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: legacySettings(),
        tutorialCompleted: true,
        sessions: [
          {
            timestamp: summary(3).timestamp,
            settings: legacySettings(),
            questionsCompleted: 10,
            firstAttemptCorrect: 8,
          },
        ],
      }),
    );

    const migrated = loadAppState();
    expect(migrated.settings).toEqual({
      ...CUSTOM_SETTINGS,
      adaptive: true,
      sessionDurationMinutes: null,
    });
    expect(migrated.tutorialCompleted).toBe(true);
    expect(migrated.sessions).toEqual([
      {
        timestamp: summary(3).timestamp,
        settings: {
          ...CUSTOM_SETTINGS,
          adaptive: true,
          sessionDurationMinutes: null,
        },
        questionsCompleted: 10,
        firstAttemptCorrect: 8,
        points: 0,
        maxStreak: 0,
        durationSeconds: 0,
        highestWhole: 0,
        adaptiveLevelUps: 0,
        endReason: 'questions',
        breakdown: {
          byRange: {
            '1-5': bucket(),
            '6-10': bucket(),
            '11-20': bucket(),
          },
          byType: {
            'missing-whole': bucket(),
            'missing-part': bucket(),
          },
        },
      },
    ]);

    const storedAgain = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      version: number;
    };
    expect(storedAgain.version).toBe(STORAGE_VERSION);
  });

  it('salvages compatible version-one fields while dropping corrupt sessions', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: legacySettings(),
        tutorialCompleted: 'yes',
        sessions: [
          {
            timestamp: summary(2).timestamp,
            settings: legacySettings(),
            questionsCompleted: 4,
            firstAttemptCorrect: 5,
          },
          {
            timestamp: summary(1).timestamp,
            settings: legacySettings(),
            questionsCompleted: 4,
            firstAttemptCorrect: 3,
          },
        ],
      }),
    );

    const migrated = loadAppState();
    expect(migrated.settings.adaptive).toBe(true);
    expect(migrated.tutorialCompleted).toBe(false);
    expect(migrated.sessions).toHaveLength(1);
    expect(migrated.sessions[0]?.firstAttemptCorrect).toBe(3);
  });

  it('falls back safely for malformed JSON and unknown versions', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadAppState()).toEqual({
      settings: DEFAULT_SETTINGS,
      tutorialCompleted: false,
      sessions: [],
    });

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION + 1,
        settings: CUSTOM_SETTINGS,
        tutorialCompleted: true,
        sessions: [summary(1)],
      }),
    );
    expect(loadAppState()).toEqual({
      settings: DEFAULT_SETTINGS,
      tutorialCompleted: false,
      sessions: [],
    });
  });

  it('salvages valid fields and drops invalid fields from the current version', () => {
    const validSummary = summary(4);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: { ...CUSTOM_SETTINGS, minWhole: -1 },
        tutorialCompleted: 'yes',
        sessions: [
          validSummary,
          { ...summary(3), firstAttemptCorrect: 11 },
          { ...summary(2), timestamp: 'not-a-date' },
          { ...summary(1), points: -1 },
          {
            ...summary(5),
            breakdown: {
              ...breakdown(),
              byRange: {
                ...breakdown().byRange,
                '1-5': bucket({ attempted: 2, solved: 3, totalAttempts: 3 }),
              },
            },
          },
        ],
      }),
    );

    expect(loadAppState()).toEqual({
      settings: DEFAULT_SETTINGS,
      tutorialCompleted: false,
      sessions: [validSummary],
    });
  });

  it('drops summaries whose range, type, and completion totals disagree', () => {
    const inconsistent = summary(7);
    inconsistent.breakdown.byType['missing-part'].attempted += 1;
    inconsistent.breakdown.byType['missing-part'].totalAttempts += 1;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: CUSTOM_SETTINGS,
        tutorialCompleted: true,
        sessions: [inconsistent],
      }),
    );

    expect(loadSessionSummaries()).toEqual([]);
  });

  it('rejects a countdown on a finite question session', () => {
    saveSettings(CUSTOM_SETTINGS);
    saveSettings({
      ...CUSTOM_SETTINGS,
      sessionDurationMinutes: 5,
    } as PracticeSettings);

    expect(loadSettings()).toEqual(CUSTOM_SETTINGS);
  });

  it('does not persist extra profile or individual-answer fields', () => {
    const settingsWithProfile = {
      ...CUSTOM_SETTINGS,
      childName: 'A child',
    } as PracticeSettings;
    const summaryWithAnswers = {
      ...summary(6),
      childName: 'A child',
      answers: [3, 4, 5],
      settings: settingsWithProfile,
    } as SessionSummary;

    saveSettings(settingsWithProfile);
    addSessionSummary(summaryWithAnswers);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      settings: Record<string, unknown>;
      sessions: Array<
        Record<string, unknown> & { settings: Record<string, unknown> }
      >;
    };
    expect(Object.keys(persisted.settings).sort()).toEqual(
      [
        'adaptive',
        'exerciseMode',
        'maxWhole',
        'minWhole',
        'orientation',
        'preset',
        'sessionDurationMinutes',
        'sessionLength',
        'zeroPolicy',
      ].sort(),
    );
    expect(persisted.sessions).toHaveLength(1);
    const persistedSummary = persisted.sessions[0]!;
    expect(Object.keys(persistedSummary).sort()).toEqual(
      [
        'adaptiveLevelUps',
        'breakdown',
        'durationSeconds',
        'endReason',
        'firstAttemptCorrect',
        'highestWhole',
        'maxStreak',
        'points',
        'questionsCompleted',
        'settings',
        'timestamp',
      ].sort(),
    );
    expect(persistedSummary.settings).not.toHaveProperty('childName');
    expect(persistedSummary).not.toHaveProperty('answers');
  });

  it('returns deep-independent breakdown data', () => {
    addSessionSummary(summary(1));
    const first = loadAppState();
    const second = loadAppState();

    first.sessions[0]!.breakdown.byRange['1-5'].attempted = 999;
    expect(second.sessions[0]!.breakdown.byRange['1-5'].attempted).toBe(4);
  });

  it('repairs corrupt storage on the next valid write', () => {
    localStorage.setItem(STORAGE_KEY, 'bad-json');

    saveSettings(CUSTOM_SETTINGS);

    expect(loadAppState()).toEqual({
      settings: CUSTOM_SETTINGS,
      tutorialCompleted: false,
      sessions: [],
    });
    expect(() => JSON.parse(localStorage.getItem(STORAGE_KEY)!)).not.toThrow();
  });

  it('stays usable when browser storage access throws', () => {
    const unavailableStorage: StorageAdapter = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('full');
      },
    };

    expect(loadAppState(unavailableStorage)).toEqual({
      settings: DEFAULT_SETTINGS,
      tutorialCompleted: false,
      sessions: [],
    });
    expect(saveSettings(CUSTOM_SETTINGS, unavailableStorage).settings).toEqual(
      CUSTOM_SETTINGS,
    );
    expect(setTutorialCompleted(true, unavailableStorage).tutorialCompleted).toBe(
      true,
    );
    expect(addSessionSummary(summary(1), unavailableStorage).sessions).toEqual([
      summary(1),
    ]);
  });

  it('ignores invalid values supplied to write functions at runtime', () => {
    saveSettings(CUSTOM_SETTINGS);
    addSessionSummary(summary(1));

    saveSettings(
      { ...CUSTOM_SETTINGS, maxWhole: Number.NaN } as PracticeSettings,
    );
    addSessionSummary(
      { ...summary(2), firstAttemptCorrect: -1 } as SessionSummary,
    );

    expect(loadSettings()).toEqual(CUSTOM_SETTINGS);
    expect(loadSessionSummaries()).toEqual([summary(1)]);
  });

  it('rejects stored ranges outside the supported 1 to 20 boundary', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        settings: { ...CUSTOM_SETTINGS, maxWhole: 1_000_000 },
        tutorialCompleted: true,
        sessions: [],
      }),
    );

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
