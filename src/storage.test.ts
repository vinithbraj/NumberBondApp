// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './domain/types';
import type { PracticeSettings, SessionSummary } from './domain/types';
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
  orientation: 'whole-bottom',
};

function summary(
  day: number,
  overrides: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    timestamp: new Date(Date.UTC(2026, 0, day)).toISOString(),
    settings: { ...CUSTOM_SETTINGS },
    questionsCompleted: 10,
    firstAttemptCorrect: 8,
    ...overrides,
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

  it('round-trips settings and tutorial completion in one versioned record', () => {
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

  it('falls back safely for malformed JSON and outdated versions', () => {
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
          { ...summary(1), settings: { ...CUSTOM_SETTINGS, maxWhole: 2 } },
        ],
      }),
    );

    expect(loadAppState()).toEqual({
      settings: DEFAULT_SETTINGS,
      tutorialCompleted: false,
      sessions: [validSummary],
    });
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
      sessions: Array<Record<string, unknown> & { settings: Record<string, unknown> }>;
    };
    expect(Object.keys(persisted.settings).sort()).toEqual(
      [
        'exerciseMode',
        'maxWhole',
        'minWhole',
        'orientation',
        'preset',
        'sessionLength',
        'zeroPolicy',
      ].sort(),
    );
    expect(persisted.sessions).toHaveLength(1);
    const persistedSummary = persisted.sessions[0]!;
    expect(Object.keys(persistedSummary).sort()).toEqual(
      [
        'firstAttemptCorrect',
        'questionsCompleted',
        'settings',
        'timestamp',
      ].sort(),
    );
    expect(persistedSummary.settings).not.toHaveProperty('childName');
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
