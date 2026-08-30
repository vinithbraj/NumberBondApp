import { describe, expect, it } from 'vitest'

import { scoreQuestion } from './scoring'

describe('scoreQuestion', () => {
  it.each([
    [1, 10, 'Great first try!'],
    [2, 7, 'Nice thinking!'],
    [3, 4, 'You kept going!'],
    [9, 4, 'You kept going!'],
  ] as const)(
    'awards the expected base for attempt %i',
    (attemptNumber, basePoints, label) => {
      expect(scoreQuestion({ attemptNumber, revealed: false })).toEqual({
        points: basePoints,
        basePoints,
        streakBonus: 0,
        newStreak: 1,
        label,
      })
    },
  )

  it('adds a subtle streak bonus from the second solve onward', () => {
    expect(
      scoreQuestion({ attemptNumber: 1, revealed: false }, 1),
    ).toMatchObject({
      points: 11,
      basePoints: 10,
      streakBonus: 1,
      newStreak: 2,
    })
  })

  it('counts retry solves toward the solved-without-help streak', () => {
    expect(
      scoreQuestion({ attemptNumber: 2, revealed: false }, 2),
    ).toEqual({
      points: 9,
      basePoints: 7,
      streakBonus: 2,
      newStreak: 3,
      label: '3 in a row!',
    })
  })

  it('caps the streak bonus at five points', () => {
    expect(
      scoreQuestion({ attemptNumber: 1, revealed: false }, 100),
    ).toMatchObject({
      points: 15,
      streakBonus: 5,
      newStreak: 101,
      label: '101 in a row!',
    })
  })

  it('awards one point and resets the streak for a revealed answer', () => {
    expect(scoreQuestion({ attemptNumber: 4, revealed: true }, 8)).toEqual({
      points: 1,
      basePoints: 1,
      streakBonus: 0,
      newStreak: 0,
      label: 'Good learning!',
    })
  })

  it('normalizes invalid counters without producing negative points', () => {
    const result = scoreQuestion(
      { attemptNumber: Number.NaN, revealed: false },
      -20,
    )

    expect(result).toMatchObject({
      points: 4,
      basePoints: 4,
      streakBonus: 0,
      newStreak: 1,
    })
    expect(result.points).toBeGreaterThanOrEqual(0)
  })
})
