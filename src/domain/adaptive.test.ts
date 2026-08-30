import { describe, expect, it } from 'vitest'

import { exerciseKey, isZeroBond } from './exerciseGenerator'
import {
  createAdaptiveState,
  recordAdaptiveOutcome,
  selectNextAdaptiveExercise,
  type AdaptiveState,
} from './adaptive'
import {
  DEFAULT_SETTINGS,
  type BondExercise,
  type PracticeSettings,
} from './types'

function settings(
  overrides: Partial<PracticeSettings & { adaptive: boolean }> = {},
): PracticeSettings & { adaptive: boolean } {
  return {
    ...DEFAULT_SETTINGS,
    preset: 'custom',
    adaptive: true,
    ...overrides,
  }
}

function firstTry(state: AdaptiveState, config = settings()): AdaptiveState {
  return recordAdaptiveOutcome(state, config, {
    attemptNumber: 1,
    revealed: false,
  })
}

function assisted(state: AdaptiveState, config = settings()): AdaptiveState {
  return recordAdaptiveOutcome(state, config, {
    attemptNumber: 2,
    revealed: false,
  })
}

describe('adaptive pacing', () => {
  it('starts within an inclusive band of at most five configured wholes', () => {
    expect(createAdaptiveState(settings({ minWhole: 1, maxWhole: 20 }))).toMatchObject({
      startingMax: 5,
      currentMax: 5,
    })
    expect(createAdaptiveState(settings({ minWhole: 8, maxWhole: 10 }))).toMatchObject({
      startingMax: 10,
      currentMax: 10,
    })
  })

  it('sanitizes reversed and out-of-bounds configured ranges', () => {
    expect(
      createAdaptiveState(settings({ minWhole: 50, maxWhole: -2 })),
    ).toMatchObject({ startingMax: 5, currentMax: 5 })
  })

  it('uses the full configured range when adaptation is disabled', () => {
    const config = settings({ minWhole: 1, maxWhole: 20, adaptive: false })
    let state = createAdaptiveState(config)

    expect(state.currentMax).toBe(20)
    state = firstTry(state, config)
    state = firstTry(state, config)
    state = firstTry(state, config)
    expect(state).toMatchObject({
      currentMax: 20,
      consecutiveFirstTry: 0,
      consecutiveAssisted: 0,
    })
  })

  it('raises the ceiling by two after three consecutive first tries', () => {
    const config = settings({ minWhole: 1, maxWhole: 20 })
    let state = createAdaptiveState(config)

    state = firstTry(state, config)
    state = firstTry(state, config)
    expect(state.currentMax).toBe(5)
    state = firstTry(state, config)

    expect(state).toMatchObject({
      currentMax: 7,
      consecutiveFirstTry: 0,
      consecutiveAssisted: 0,
    })
  })

  it('never raises the ceiling above the configured maximum', () => {
    const config = settings({ minWhole: 4, maxWhole: 9 })
    let state = createAdaptiveState(config)
    expect(state.currentMax).toBe(8)

    state = firstTry(firstTry(firstTry(state, config), config), config)
    expect(state.currentMax).toBe(9)
  })

  it('requires consecutive first-try solves before progressing', () => {
    const config = settings({ minWhole: 1, maxWhole: 20 })
    let state = firstTry(createAdaptiveState(config), config)
    state = assisted(state, config)
    state = firstTry(state, config)
    state = firstTry(state, config)

    expect(state).toMatchObject({ currentMax: 5, consecutiveFirstTry: 2 })
  })

  it('gently lowers the ceiling after two assisted outcomes', () => {
    const config = settings({ minWhole: 1, maxWhole: 20 })
    let state: AdaptiveState = {
      ...createAdaptiveState(config),
      currentMax: 9,
    }

    state = assisted(state, config)
    expect(state.currentMax).toBe(9)
    state = assisted(state, config)
    expect(state).toMatchObject({
      currentMax: 8,
      consecutiveAssisted: 0,
      consecutiveFirstTry: 0,
    })
  })

  it('treats revealed answers as assisted and never drops below the floor', () => {
    const config = settings({ minWhole: 1, maxWhole: 20 })
    let state = createAdaptiveState(config)
    const reveal = { attemptNumber: 1, revealed: true }

    state = recordAdaptiveOutcome(state, config, reveal)
    state = recordAdaptiveOutcome(state, config, reveal)
    expect(state.currentMax).toBe(5)
  })
})

describe('selectNextAdaptiveExercise', () => {
  it('uses only arithmetically valid questions in the current range', () => {
    const config = settings({ minWhole: 3, maxWhole: 20 })
    const state = { ...createAdaptiveState(config), currentMax: 9 }

    for (const random of [0, 0.25, 0.5, 0.999]) {
      const { exercise } = selectNextAdaptiveExercise(
        config,
        state,
        undefined,
        () => random,
      )
      expect(exercise).toBeDefined()
      expect(exercise!.whole).toBeGreaterThanOrEqual(3)
      expect(exercise!.whole).toBeLessThanOrEqual(9)
      expect(exercise!.parts[0] + exercise!.parts[1]).toBe(exercise!.whole)
    }
  })

  it('starts mixed mode with a whole then alternates part and whole', () => {
    const config = settings({ exerciseMode: 'mixed' })
    let state = createAdaptiveState(config)
    const positions: string[] = []
    let previous: BondExercise | undefined

    for (let index = 0; index < 6; index += 1) {
      const selection = selectNextAdaptiveExercise(
        config,
        state,
        previous,
        () => 0.4,
      )
      expect(selection.exercise).toBeDefined()
      positions.push(
        selection.exercise!.missing === 'whole' ? 'whole' : 'part',
      )
      previous = selection.exercise
      state = selection.state
    }

    expect(positions).toEqual([
      'whole',
      'part',
      'whole',
      'part',
      'whole',
      'part',
    ])
  })

  it.each([
    ['missing-whole', true],
    ['missing-part', false],
  ] as const)('respects configured %s mode', (exerciseMode, missingWhole) => {
    const config = settings({ exerciseMode })
    const result = selectNextAdaptiveExercise(
      config,
      createAdaptiveState(config),
      undefined,
      () => 0.5,
    )

    expect(result.exercise?.missing === 'whole').toBe(missingWhole)
  })

  it('avoids immediate equivalent duplicates when an alternative exists', () => {
    const config = settings({
      minWhole: 2,
      maxWhole: 3,
      exerciseMode: 'missing-whole',
    })
    const state = createAdaptiveState(config)
    const first = selectNextAdaptiveExercise(
      config,
      state,
      undefined,
      () => 0,
    ).exercise!
    const second = selectNextAdaptiveExercise(
      config,
      state,
      first,
      () => 0,
    ).exercise!

    expect(exerciseKey(second)).not.toBe(exerciseKey(first))
  })

  it('avoids consecutive zero bonds when a non-zero option exists', () => {
    const config = settings({
      minWhole: 2,
      maxWhole: 2,
      exerciseMode: 'missing-whole',
      zeroPolicy: 'allow',
    })
    const previous: BondExercise = {
      whole: 2,
      parts: [0, 2],
      missing: 'whole',
    }
    const { exercise } = selectNextAdaptiveExercise(
      config,
      createAdaptiveState(config),
      previous,
      () => 0,
    )

    expect(exercise).toBeDefined()
    expect(isZeroBond(exercise!)).toBe(false)
  })

  it('is deterministic with injected randomness', () => {
    const config = settings({ exerciseMode: 'missing-part' })
    const state = createAdaptiveState(config)
    const first = selectNextAdaptiveExercise(
      config,
      state,
      undefined,
      () => 0.73,
    )
    const second = selectNextAdaptiveExercise(
      config,
      state,
      undefined,
      () => 0.73,
    )

    expect(first).toEqual(second)
  })

  it('returns no question for an impossible no-zero range', () => {
    const config = settings({
      minWhole: 1,
      maxWhole: 1,
      zeroPolicy: 'exclude',
    })
    const state = createAdaptiveState(config)

    expect(
      selectNextAdaptiveExercise(config, state, undefined, () => 0),
    ).toEqual({ exercise: undefined, state })
  })
})
