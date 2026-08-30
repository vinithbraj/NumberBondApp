import { describe, expect, it } from 'vitest'

import {
  buildExercisePool,
  correctAnswer,
  exerciseKey,
  generateExercise,
  generateExerciseQueue,
  isCorrectAnswer,
  isZeroBond,
} from './exerciseGenerator'
import {
  DEFAULT_SETTINGS,
  PRESET_SETTINGS,
  type BondExercise,
  type PracticeSettings,
} from './types'

function sequenceRandom(...values: number[]): () => number {
  let index = 0
  return () => values[index++ % values.length] ?? 0
}

function customSettings(
  overrides: Partial<PracticeSettings> = {},
): PracticeSettings {
  return {
    ...DEFAULT_SETTINGS,
    preset: 'custom',
    ...overrides,
  }
}

describe('buildExercisePool', () => {
  it.each(['beginner', 'standard', 'challenge'] as const)(
    'builds arithmetically valid %s preset exercises within its bounds',
    (preset) => {
      const settings = PRESET_SETTINGS[preset]
      const exercises = buildExercisePool(settings)

      expect(exercises.length).toBeGreaterThan(0)
      for (const exercise of exercises) {
        expect(exercise.parts[0] + exercise.parts[1]).toBe(exercise.whole)
        expect(exercise.whole).toBeGreaterThanOrEqual(settings.minWhole)
        expect(exercise.whole).toBeLessThanOrEqual(settings.maxWhole)
      }
    },
  )

  it('honors an inclusive custom range and excludes zero parts', () => {
    const settings = customSettings({
      minWhole: 4,
      maxWhole: 6,
      exerciseMode: 'missing-part',
      zeroPolicy: 'exclude',
    })

    const pool = buildExercisePool(settings)

    expect(new Set(pool.map(({ whole }) => whole))).toEqual(new Set([4, 5, 6]))
    expect(pool.every(({ parts }) => parts[0] > 0 && parts[1] > 0)).toBe(true)
    expect(pool.every(({ missing }) => missing !== 'whole')).toBe(true)
  })

  it('includes both orientations of zero bonds when zero is allowed', () => {
    const pool = buildExercisePool(
      customSettings({
        minWhole: 3,
        maxWhole: 3,
        exerciseMode: 'missing-whole',
        zeroPolicy: 'allow',
      }),
    )

    expect(pool).toContainEqual({ whole: 3, parts: [0, 3], missing: 'whole' })
    expect(pool).toContainEqual({ whole: 3, parts: [3, 0], missing: 'whole' })
  })

  it('handles reversed and fractional range values without looping', () => {
    const pool = buildExercisePool(
      customSettings({
        minWhole: 4.9,
        maxWhole: 2.2,
        exerciseMode: 'missing-whole',
        zeroPolicy: 'exclude',
      }),
    )

    expect(new Set(pool.map(({ whole }) => whole))).toEqual(new Set([2, 3, 4]))
  })

  it('safely handles non-finite range values', () => {
    const pool = buildExercisePool(
      customSettings({
        minWhole: Number.POSITIVE_INFINITY,
        maxWhole: Number.NaN,
        exerciseMode: 'missing-whole',
      }),
    )

    expect(pool.every(({ whole }) => whole === 1)).toBe(true)
  })

  it('caps programmatic ranges at the supported maximum', () => {
    const pool = buildExercisePool(
      customSettings({
        minWhole: 19,
        maxWhole: 1_000_000,
        exerciseMode: 'missing-whole',
      }),
    )

    expect(Math.max(...pool.map(({ whole }) => whole))).toBe(20)
  })

  it('returns an empty pool when a whole of one cannot use zero', () => {
    expect(
      buildExercisePool(
        customSettings({
          minWhole: 1,
          maxWhole: 1,
          zeroPolicy: 'exclude',
        }),
      ),
    ).toEqual([])
  })
})

describe('answer helpers', () => {
  const wholeMissing: BondExercise = {
    whole: 7,
    parts: [2, 5],
    missing: 'whole',
  }
  const firstPartMissing: BondExercise = {
    whole: 7,
    parts: [2, 5],
    missing: 'partA',
  }
  const secondPartMissing: BondExercise = {
    whole: 7,
    parts: [2, 5],
    missing: 'partB',
  }

  it('finds the correct answer for every missing position', () => {
    expect(correctAnswer(wholeMissing)).toBe(7)
    expect(correctAnswer(firstPartMissing)).toBe(2)
    expect(correctAnswer(secondPartMissing)).toBe(5)
  })

  it('accepts only an exact integer answer', () => {
    expect(isCorrectAnswer(secondPartMissing, 5)).toBe(true)
    expect(isCorrectAnswer(secondPartMissing, 4)).toBe(false)
    expect(isCorrectAnswer(secondPartMissing, 5.1)).toBe(false)
  })

  it('recognizes zero bonds and mirror-equivalent repetition keys', () => {
    expect(isZeroBond({ whole: 5, parts: [0, 5], missing: 'whole' })).toBe(true)
    expect(isZeroBond(wholeMissing)).toBe(false)
    expect(
      exerciseKey({ whole: 7, parts: [2, 5], missing: 'partA' }),
    ).toBe(exerciseKey({ whole: 7, parts: [5, 2], missing: 'partB' }))
  })
})

describe('generateExerciseQueue', () => {
  it('uses the requested finite session length by default', () => {
    expect(
      generateExerciseQueue(
        { ...PRESET_SETTINGS.beginner, sessionLength: 5 },
        undefined,
        () => 0.4,
      ),
    ).toHaveLength(5)
  })

  it('creates a finite batch for an endless session', () => {
    expect(
      generateExerciseQueue(
        { ...PRESET_SETTINGS.standard, sessionLength: 'endless' },
        undefined,
        () => 0.4,
      ),
    ).toHaveLength(20)
  })

  it.each([5, 10, 11, 20])(
    'balances mixed modes for a queue of %i',
    (count) => {
      const queue = generateExerciseQueue(
        customSettings({ exerciseMode: 'mixed' }),
        count,
        sequenceRandom(0.9, 0.15, 0.75, 0.3),
      )
      const wholeCount = queue.filter(({ missing }) => missing === 'whole').length
      const partCount = queue.length - wholeCount

      expect(Math.abs(wholeCount - partCount)).toBeLessThanOrEqual(1)
    },
  )

  it('only uses the requested missing-position family', () => {
    const wholeQueue = generateExerciseQueue(
      customSettings({ exerciseMode: 'missing-whole' }),
      15,
      () => 0.25,
    )
    const partQueue = generateExerciseQueue(
      customSettings({ exerciseMode: 'missing-part' }),
      15,
      () => 0.25,
    )

    expect(wholeQueue.every(({ missing }) => missing === 'whole')).toBe(true)
    expect(partQueue.every(({ missing }) => missing !== 'whole')).toBe(true)
  })

  it('balances the two missing-part positions', () => {
    const queue = generateExerciseQueue(
      customSettings({ exerciseMode: 'missing-part' }),
      11,
      () => 0.25,
    )
    const partACount = queue.filter(({ missing }) => missing === 'partA').length
    const partBCount = queue.filter(({ missing }) => missing === 'partB').length

    expect(Math.abs(partACount - partBCount)).toBeLessThanOrEqual(1)
  })

  it('does not place zero bonds consecutively when a non-zero bond exists', () => {
    const queue = generateExerciseQueue(
      customSettings({
        minWhole: 2,
        maxWhole: 2,
        exerciseMode: 'missing-whole',
        zeroPolicy: 'allow',
      }),
      12,
      () => 0,
    )

    for (let index = 1; index < queue.length; index += 1) {
      expect(
        isZeroBond(queue[index - 1]!) && isZeroBond(queue[index]!),
      ).toBe(false)
    }
  })

  it('avoids immediate equivalent duplicate prompts when alternatives exist', () => {
    const queue = generateExerciseQueue(
      customSettings({
        minWhole: 2,
        maxWhole: 3,
        exerciseMode: 'missing-part',
      }),
      30,
      () => 0,
    )

    for (let index = 1; index < queue.length; index += 1) {
      expect(exerciseKey(queue[index]!)).not.toBe(
        exerciseKey(queue[index - 1]!),
      )
    }
  })

  it('is deterministic with an injected random source', () => {
    const first = generateExerciseQueue(
      customSettings(),
      12,
      sequenceRandom(0.1, 0.9, 0.4, 0.65),
    )
    const second = generateExerciseQueue(
      customSettings(),
      12,
      sequenceRandom(0.1, 0.9, 0.4, 0.65),
    )

    expect(first).toEqual(second)
  })

  it('degrades gracefully when the only valid bonds contain zero', () => {
    const queue = generateExerciseQueue(
      customSettings({
        minWhole: 1,
        maxWhole: 1,
        exerciseMode: 'missing-whole',
        zeroPolicy: 'allow',
      }),
      6,
      () => 0,
    )

    expect(queue).toHaveLength(6)
    expect(queue.every(isZeroBond)).toBe(true)
  })

  it('returns an empty queue for impossible settings or non-positive counts', () => {
    const impossible = customSettings({
      minWhole: 1,
      maxWhole: 1,
      zeroPolicy: 'exclude',
    })

    expect(generateExerciseQueue(impossible, 10, () => 0)).toEqual([])
    expect(generateExerciseQueue(customSettings(), 0, () => 0)).toEqual([])
    expect(generateExerciseQueue(customSettings(), -5, () => 0)).toEqual([])
  })
})

describe('generateExercise', () => {
  it('uses injected randomness to select a valid exercise', () => {
    const settings = customSettings({
      minWhole: 4,
      maxWhole: 4,
      exerciseMode: 'missing-whole',
      zeroPolicy: 'exclude',
    })

    expect(generateExercise(settings, () => 0)).toEqual({
      whole: 4,
      parts: [1, 3],
      missing: 'whole',
    })
    expect(generateExercise(settings, () => 0.999)).toEqual({
      whole: 4,
      parts: [3, 1],
      missing: 'whole',
    })
  })
})
