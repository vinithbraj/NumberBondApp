import { describe, expect, it } from 'vitest'

import {
  buildParentReport,
  emptyMetricBucket,
  emptySessionBreakdown,
  rangeBandForWhole,
  recordQuestionResult,
  type CompletedQuestionResult,
} from './performance'
import {
  DEFAULT_SETTINGS,
  type SessionSummary,
} from './types'

function makeSummary(
  overrides: Partial<SessionSummary> = {},
  results: readonly CompletedQuestionResult[] = [],
): SessionSummary {
  const breakdown = results.reduce(
    recordQuestionResult,
    emptySessionBreakdown(),
  )

  return {
    timestamp: '2026-08-30T12:00:00.000Z',
    settings: { ...DEFAULT_SETTINGS },
    questionsCompleted: results.length,
    firstAttemptCorrect: results.filter(
      ({ firstTry, revealed }) => firstTry && !revealed,
    ).length,
    points: 0,
    maxStreak: 0,
    durationSeconds: 0,
    highestWhole: results.reduce(
      (highest, result) => Math.max(highest, result.whole),
      0,
    ),
    adaptiveLevelUps: 0,
    endReason: 'questions',
    breakdown,
    ...overrides,
  }
}

const firstTryResult = (
  whole: number,
  missingPosition: CompletedQuestionResult['missingPosition'] = 'whole',
): CompletedQuestionResult => ({
  whole,
  missingPosition,
  attempts: 1,
  firstTry: true,
  hintUsed: false,
  revealed: false,
  responseMs: 2_000,
})

describe('performance buckets', () => {
  it('creates independent empty buckets for every report dimension', () => {
    const breakdown = emptySessionBreakdown()

    expect(breakdown).toEqual({
      byRange: {
        '1-5': emptyMetricBucket(),
        '6-10': emptyMetricBucket(),
        '11-20': emptyMetricBucket(),
      },
      byType: {
        'missing-whole': emptyMetricBucket(),
        'missing-part': emptyMetricBucket(),
      },
    })
    expect(breakdown.byRange['1-5']).not.toBe(breakdown.byRange['6-10'])
    expect(breakdown.byType['missing-whole']).not.toBe(
      breakdown.byType['missing-part'],
    )
  })

  it.each([
    [1, '1-5'],
    [5, '1-5'],
    [6, '6-10'],
    [10, '6-10'],
    [11, '11-20'],
    [20, '11-20'],
  ] as const)('maps whole %i to range %s', (whole, expected) => {
    expect(rangeBandForWhole(whole)).toBe(expected)
  })

  it('immutably records an assisted answer in its range and type', () => {
    const initial = emptySessionBreakdown()
    const updated = recordQuestionResult(initial, {
      whole: 8,
      missingPosition: 'partA',
      attempts: 2,
      firstTry: false,
      hintUsed: true,
      revealed: false,
      responseMs: 4_250,
    })
    const expected = {
      attempted: 1,
      solved: 1,
      firstTryCorrect: 0,
      hintsUsed: 1,
      reveals: 0,
      totalAttempts: 2,
      totalResponseMs: 4_250,
    }

    expect(updated.byRange['6-10']).toEqual(expected)
    expect(updated.byType['missing-part']).toEqual(expected)
    expect(initial).toEqual(emptySessionBreakdown())
    expect(updated).not.toBe(initial)
  })

  it('counts a revealed answer as attempted but not solved', () => {
    const updated = recordQuestionResult(emptySessionBreakdown(), {
      whole: 12,
      missingPosition: 'whole',
      attempts: 3,
      firstTry: true,
      hintUsed: true,
      revealed: true,
      responseMs: 9_500,
    })

    expect(updated.byRange['11-20']).toEqual({
      attempted: 1,
      solved: 0,
      firstTryCorrect: 0,
      hintsUsed: 1,
      reveals: 1,
      totalAttempts: 3,
      totalResponseMs: 9_500,
    })
    expect(updated.byType['missing-whole']).toEqual(
      updated.byRange['11-20'],
    )
  })

  it('records an unfinished submitted question without calling it solved or revealed', () => {
    const updated = recordQuestionResult(emptySessionBreakdown(), {
      whole: 9,
      missingPosition: 'partB',
      attempts: 2,
      firstTry: false,
      hintUsed: true,
      revealed: false,
      solved: false,
      responseMs: 8_000,
    })

    expect(updated.byType['missing-part']).toEqual({
      attempted: 1,
      solved: 0,
      firstTryCorrect: 0,
      hintsUsed: 1,
      reveals: 0,
      totalAttempts: 2,
      totalResponseMs: 8_000,
    })
  })

  it('sanitizes invalid counters so an aggregate stays finite', () => {
    const updated = recordQuestionResult(emptySessionBreakdown(), {
      whole: 3,
      missingPosition: 'partB',
      attempts: Number.NaN,
      firstTry: false,
      hintUsed: false,
      revealed: false,
      responseMs: Number.POSITIVE_INFINITY,
    })

    expect(updated.byRange['1-5'].totalAttempts).toBe(1)
    expect(updated.byRange['1-5'].totalResponseMs).toBe(0)
  })
})

describe('buildParentReport', () => {
  it('returns a stable, display-ready empty report', () => {
    const report = buildParentReport([])

    expect(report).toMatchObject({
      sessions: 0,
      questions: 0,
      totalPoints: 0,
      totalPracticeSeconds: 0,
      firstTryRate: null,
      solveRate: null,
      averageAttempts: null,
      averageResponseSeconds: null,
      hintRate: null,
      revealRate: null,
      bestStreak: 0,
      highestWhole: 0,
      totalAdaptiveLevelUps: 0,
      strongestArea: null,
      focusArea: null,
      recentTrend: {
        direction: 'not-enough-data',
        currentFirstTryRate: null,
        previousFirstTryRate: null,
        change: null,
        currentSessionCount: 0,
        previousSessionCount: 0,
      },
    })
    expect(report.rangeRows.map(({ key }) => key)).toEqual([
      '1-5',
      '6-10',
      '11-20',
    ])
    expect(report.typeRows.map(({ key }) => key)).toEqual([
      'missing-whole',
      'missing-part',
    ])
    expect(report.rangeRows.every(({ attempted }) => attempted === 0)).toBe(
      true,
    )
  })

  it('aggregates session, accuracy, help, timing, and skill metrics', () => {
    const firstSessionResults: CompletedQuestionResult[] = [
      firstTryResult(3),
      {
        whole: 8,
        missingPosition: 'partA',
        attempts: 2,
        firstTry: false,
        hintUsed: true,
        revealed: false,
        responseMs: 6_000,
      },
    ]
    const secondSessionResults: CompletedQuestionResult[] = [
      {
        whole: 12,
        missingPosition: 'partB',
        attempts: 3,
        firstTry: false,
        hintUsed: true,
        revealed: true,
        responseMs: 10_000,
      },
      firstTryResult(4),
    ]
    const sessions = [
      makeSummary(
        {
          timestamp: '2026-08-29T12:00:00.000Z',
          points: 22,
          maxStreak: 2,
          durationSeconds: 40,
        },
        firstSessionResults,
      ),
      makeSummary(
        {
          timestamp: '2026-08-30T12:00:00.000Z',
          points: 18,
          maxStreak: 3,
          durationSeconds: 50,
          adaptiveLevelUps: 1,
        },
        secondSessionResults,
      ),
    ]

    const report = buildParentReport(sessions)

    expect(report).toMatchObject({
      sessions: 2,
      questions: 4,
      totalPoints: 40,
      totalPracticeSeconds: 90,
      firstTryRate: 0.5,
      solveRate: 0.75,
      averageAttempts: 1.75,
      averageResponseSeconds: 5,
      hintRate: 0.5,
      revealRate: 0.25,
      bestStreak: 3,
      highestWhole: 12,
      totalAdaptiveLevelUps: 1,
    })
    expect(report.rangeRows.find(({ key }) => key === '1-5')).toMatchObject({
      attempted: 2,
      firstTryRate: 1,
      solveRate: 1,
      averageResponseSeconds: 2,
    })
    expect(
      report.typeRows.find(({ key }) => key === 'missing-part'),
    ).toMatchObject({ attempted: 2, solved: 1, hintRate: 1, revealRate: 0.5 })

    // Four samples are intentionally too few to label a learning pattern.
    expect(report.strongestArea).toBeNull()
    expect(report.focusArea).toBeNull()
  })

  it('includes submitted unfinished questions in report denominators', () => {
    const report = buildParentReport([
      makeSummary(
        { questionsCompleted: 1, firstAttemptCorrect: 1 },
        [
          firstTryResult(4),
          {
            whole: 8,
            missingPosition: 'partA',
            attempts: 2,
            firstTry: false,
            hintUsed: true,
            revealed: false,
            solved: false,
            responseMs: 9_000,
          },
        ],
      ),
    ])

    expect(report).toMatchObject({
      questions: 2,
      firstTryRate: 0.5,
      solveRate: 0.5,
      hintRate: 0.5,
    })
  })

  it('identifies clearly different areas only after enough practice', () => {
    const strong = Array.from({ length: 5 }, () => firstTryResult(4))
    const focus: CompletedQuestionResult[] = Array.from(
      { length: 5 },
      () => ({
        whole: 14,
        missingPosition: 'partA',
        attempts: 3,
        firstTry: false,
        hintUsed: true,
        revealed: true,
        responseMs: 12_000,
      }),
    )

    const report = buildParentReport([makeSummary({}, [...strong, ...focus])])

    expect(report.strongestArea).not.toBeNull()
    expect(report.focusArea).not.toBeNull()
    expect(report.strongestArea?.masteryScore).toBe(1)
    expect(report.focusArea?.masteryScore).toBe(0)
    expect(['Numbers 1–5', 'Finding the whole']).toContain(
      report.strongestArea?.label,
    )
    expect(['Numbers 11–20', 'Finding a part']).toContain(
      report.focusArea?.label,
    )
  })

  it('does not invent a strength or focus when eligible areas are even', () => {
    const results = [
      ...Array.from({ length: 5 }, () => firstTryResult(4)),
      ...Array.from({ length: 5 }, () => firstTryResult(8, 'partA')),
    ]
    const report = buildParentReport([makeSummary({}, results)])

    expect(report.strongestArea).toBeNull()
    expect(report.focusArea).toBeNull()
  })

  it('uses stored session totals even when an older breakdown has no detail', () => {
    const report = buildParentReport([
      makeSummary({ questionsCompleted: 10, firstAttemptCorrect: 7 }),
    ])

    expect(report.questions).toBe(10)
    expect(report.firstTryRate).toBe(0.7)
    expect(report.solveRate).toBeNull()
    expect(report.averageResponseSeconds).toBeNull()
  })

  it('compares recent sessions with the preceding sessions by timestamp', () => {
    const sessions = [
      makeSummary({
        timestamp: '2026-08-27T12:00:00.000Z',
        questionsCompleted: 10,
        firstAttemptCorrect: 2,
      }),
      makeSummary({
        timestamp: '2026-08-30T12:00:00.000Z',
        questionsCompleted: 10,
        firstAttemptCorrect: 9,
      }),
      makeSummary({
        timestamp: '2026-08-25T12:00:00.000Z',
        questionsCompleted: 10,
        firstAttemptCorrect: 3,
      }),
      makeSummary({
        timestamp: '2026-08-29T12:00:00.000Z',
        questionsCompleted: 10,
        firstAttemptCorrect: 8,
      }),
      makeSummary({
        timestamp: '2026-08-26T12:00:00.000Z',
        questionsCompleted: 10,
        firstAttemptCorrect: 4,
      }),
      makeSummary({
        timestamp: '2026-08-28T12:00:00.000Z',
        questionsCompleted: 10,
        firstAttemptCorrect: 7,
      }),
    ]

    expect(buildParentReport(sessions).recentTrend).toEqual({
      direction: 'improving',
      currentFirstTryRate: 0.8,
      previousFirstTryRate: 0.3,
      change: 0.5,
      currentSessionCount: 3,
      previousSessionCount: 3,
    })
  })

  it('keeps small trend changes neutral and handles a single session', () => {
    const steady = buildParentReport([
      makeSummary({
        timestamp: '2026-08-30T12:00:00.000Z',
        questionsCompleted: 10,
        firstAttemptCorrect: 7,
      }),
      makeSummary({
        timestamp: '2026-08-29T12:00:00.000Z',
        questionsCompleted: 10,
        firstAttemptCorrect: 7,
      }),
    ])
    const oneSession = buildParentReport([
      makeSummary({ questionsCompleted: 5, firstAttemptCorrect: 4 }),
    ])

    expect(steady.recentTrend.direction).toBe('steady')
    expect(oneSession.recentTrend).toMatchObject({
      direction: 'not-enough-data',
      currentFirstTryRate: 0.8,
      previousFirstTryRate: null,
      currentSessionCount: 1,
      previousSessionCount: 0,
    })
  })

  it('does not infer a trend from two one-question sessions', () => {
    const report = buildParentReport([
      makeSummary({
        timestamp: '2026-08-30T12:00:00.000Z',
        questionsCompleted: 1,
        firstAttemptCorrect: 1,
      }),
      makeSummary({
        timestamp: '2026-08-29T12:00:00.000Z',
        questionsCompleted: 1,
        firstAttemptCorrect: 0,
      }),
    ])

    expect(report.recentTrend).toMatchObject({
      direction: 'not-enough-data',
      currentFirstTryRate: 1,
      previousFirstTryRate: 0,
    })
  })
})
