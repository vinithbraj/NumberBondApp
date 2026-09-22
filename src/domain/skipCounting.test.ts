import { describe, expect, it } from 'vitest'
import {
  COUNTING_STEPS,
  ROUND_LENGTH,
  countingReducer,
  countingStars,
  createCountingQuestions,
  createCountingRound,
  summarizeCountingRound,
  type CountingRound,
} from './skipCounting'

function answer(state: CountingRound, now = state.lastTick + 1000) {
  return countingReducer(state, {
    type: 'answer',
    value: state.questions[state.index]!.answer,
    now,
  })
}

describe('skip-counting questions', () => {
  it('generates bounded, solvable patterns and distinct choices for every step', () => {
    for (const step of COUNTING_STEPS) {
      for (const random of [() => 0, () => 0.99999, Math.random]) {
        const questions = createCountingQuestions(step, random)
        expect(questions).toHaveLength(ROUND_LENGTH)
        for (const [index, question] of questions.entries()) {
          expect(question.numbers).toHaveLength(4)
          if (index < 4) expect(question.missing).toBe(3)
          if (index >= 4) expect([1, 2]).toContain(question.missing)
          expect(question.answer).toBe(question.numbers[question.missing])
          expect(new Set(question.choices).size).toBe(3)
          expect(question.choices).toContain(question.answer)
          for (const [position, value] of question.numbers.entries()) {
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThanOrEqual(step * 10)
            if (position > 0)
              expect(value - question.numbers[position - 1]!).toBe(step)
          }
          for (const choice of question.choices) {
            expect(Number.isInteger(choice)).toBe(true)
            expect(choice).toBeGreaterThanOrEqual(0)
            expect(choice).toBeLessThanOrEqual(step * 10)
          }
        }
      }
    }
  })
})

describe('skip-counting rounds', () => {
  it('awards points once per question, earns three stars, and ends after eight hops', () => {
    let state = createCountingRound({ step: 5, timer: 0 }, 0)
    for (let index = 0; index < ROUND_LENGTH; index++) {
      state = answer(state)
      const duplicate = answer(state)
      expect(duplicate.points).toBe(state.points)
      expect(duplicate.completed).toBe(state.completed)
      state = countingReducer(state, { type: 'next', now: state.lastTick })
    }
    expect(state).toMatchObject({
      points: 90,
      firstTry: 8,
      solved: 8,
      completed: 8,
      bestStreak: 8,
      endReason: 'complete',
    })
    expect(countingStars(state.completed)).toBe(3)
    expect(countingReducer(state, { type: 'next', now: 999999 })).toBe(state)
  })

  it('supports retries, hints and reveals without treating them as first-try mastery', () => {
    let state = createCountingRound({ step: 3, timer: 0 }, 0)
    const wrong = state.questions[0]!.choices.find(
      (choice) => choice !== state.questions[0]!.answer,
    )!
    state = countingReducer(state, { type: 'answer', value: wrong, now: 1000 })
    expect(state.points).toBe(0)
    state = answer(state)
    expect(state).toMatchObject({
      points: 5,
      firstTry: 0,
      solved: 1,
      streak: 0,
    })
    state = countingReducer(state, { type: 'next', now: 2000 })
    state = countingReducer(state, { type: 'hint', now: 3000 })
    state = countingReducer(state, { type: 'hint', now: 3000 })
    state = answer(state)
    expect(state).toMatchObject({
      points: 10,
      firstTry: 0,
      solved: 2,
      hints: 1,
    })
    state = countingReducer(state, { type: 'next', now: 4000 })
    state = countingReducer(state, { type: 'reveal', now: 5000 })
    expect(state).toMatchObject({
      points: 11,
      completed: 3,
      solved: 2,
      reveals: 1,
      streak: 0,
    })
  })

  it('counts unfinished attempted questions when a game ends', () => {
    let state = createCountingRound({ step: 10, timer: 0 }, 0)
    state = countingReducer(state, { type: 'hint', now: 4000 })
    state = countingReducer(state, { type: 'finish', now: 5000 })
    expect(summarizeCountingRound(state)).toMatchObject({
      attempted: 1,
      completed: 0,
      solved: 0,
      hints: 1,
      points: 0,
      durationSeconds: 5,
      endReason: 'ended',
    })
  })

  it('excludes paused time and checks the deadline before accepting an answer', () => {
    let state = createCountingRound({ step: 2, timer: 120 }, 0)
    state = countingReducer(state, { type: 'pause', now: 10000 })
    expect(answer(state, 20000)).toBe(state)
    state = countingReducer(state, { type: 'resume', now: 500000 })
    state = countingReducer(state, { type: 'tick', now: 609999 })
    expect(state.endReason).toBeNull()
    expect(state.elapsedMs).toBe(119999)
    state = answer(state, 610000)
    expect(state).toMatchObject({
      elapsedMs: 120000,
      endReason: 'timer',
      points: 0,
      completed: 0,
    })
  })

  it('ends on the next timer tick even if a browser delays interval callbacks', () => {
    const state = countingReducer(
      createCountingRound({ step: 5, timer: 180 }, 0),
      { type: 'tick', now: 400000 },
    )
    expect(state).toMatchObject({ endReason: 'timer', elapsedMs: 180000 })
  })

  it('keeps no-rush games open and ignores premature next or repeated wrong choices', () => {
    let state = createCountingRound({ step: 1, timer: 0 }, 0)
    state = countingReducer(state, { type: 'next', now: 100 })
    expect(state.index).toBe(0)
    const wrong = state.questions[0]!.choices.find(
      (choice) => choice !== state.questions[0]!.answer,
    )!
    state = countingReducer(state, { type: 'answer', value: wrong, now: 1000 })
    state = countingReducer(state, { type: 'answer', value: wrong, now: 1000 })
    expect(state.wrongChoices).toEqual([wrong])
    state = countingReducer(state, { type: 'tick', now: 1000000 })
    expect(state.endReason).toBeNull()
  })
})
