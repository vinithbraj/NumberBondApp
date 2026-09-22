export const COUNTING_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export const ROUND_LENGTH = 8
export type CountingStep = (typeof COUNTING_STEPS)[number]
export type CountingTimer = 0 | 120 | 180

export interface CountingSettings {
  step: CountingStep
  timer: CountingTimer
}

export interface CountingQuestion {
  numbers: number[]
  missing: number
  answer: number
  choices: number[]
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other]!, result[index]!]
  }
  return result
}

/** Start with forward hops, then transfer the pattern to an interior gap. */
export function createCountingQuestions(
  step: CountingStep,
  random: () => number = Math.random,
): CountingQuestion[] {
  return Array.from({ length: ROUND_LENGTH }, (_, index) => {
    const start = index < 3 ? index : Math.floor(random() * 8)
    const numbers = Array.from(
      { length: 4 },
      (_, offset) => (start + offset) * step,
    )
    const missing = index < 4 ? 3 : 1 + Math.floor(random() * 2)
    const answer = numbers[missing]!
    const candidates = [
      ...new Set([
        answer - step,
        answer + step,
        answer - 1,
        answer + 1,
        answer + 2 * step,
        answer - 2 * step,
      ]),
    ].filter((value) => value >= 0 && value <= step * 10 && value !== answer)
    return {
      numbers,
      missing,
      answer,
      choices: shuffle(
        [answer, ...shuffle(candidates, random).slice(0, 2)],
        random,
      ),
    }
  })
}

export interface CountingRound {
  settings: CountingSettings
  questions: CountingQuestion[]
  index: number
  phase: 'answering' | 'correct' | 'revealed'
  wrongChoices: number[]
  hint: boolean
  touched: boolean
  completed: number
  solved: number
  firstTry: number
  hints: number
  reveals: number
  points: number
  award: number
  streak: number
  bestStreak: number
  elapsedMs: number
  lastTick: number
  paused: boolean
  endReason: 'complete' | 'timer' | 'ended' | null
}

export type CountingAction =
  | { type: 'answer'; value: number; now: number }
  | {
      type: 'hint' | 'reveal' | 'next' | 'tick' | 'pause' | 'resume' | 'finish'
      now: number
    }

export function createCountingRound(
  settings: CountingSettings,
  now: number,
): CountingRound {
  return {
    settings: { ...settings },
    questions: createCountingQuestions(settings.step),
    index: 0,
    phase: 'answering',
    wrongChoices: [],
    hint: false,
    touched: false,
    completed: 0,
    solved: 0,
    firstTry: 0,
    hints: 0,
    reveals: 0,
    points: 0,
    award: 0,
    streak: 0,
    bestStreak: 0,
    elapsedMs: 0,
    lastTick: now,
    paused: false,
    endReason: null,
  }
}

export function countingReducer(
  state: CountingRound,
  action: CountingAction,
): CountingRound {
  if (state.endReason) return state
  if (state.paused) {
    if (action.type === 'resume')
      return { ...state, paused: false, lastTick: action.now }
    if (action.type === 'finish') return { ...state, endReason: 'ended' }
    return state
  }
  const elapsedMs = state.elapsedMs + Math.max(0, action.now - state.lastTick)
  const limit = state.settings.timer * 1000
  const next = { ...state, elapsedMs, lastTick: action.now }
  if (limit > 0 && elapsedMs >= limit) {
    return { ...next, elapsedMs: limit, endReason: 'timer' }
  }
  if (action.type === 'tick' || action.type === 'resume') return next
  if (action.type === 'pause') return { ...next, paused: true }
  if (action.type === 'finish') return { ...next, endReason: 'ended' }
  if (action.type === 'next') {
    if (state.phase === 'answering') return next
    if (state.completed === ROUND_LENGTH)
      return { ...next, endReason: 'complete' }
    return {
      ...next,
      index: state.index + 1,
      phase: 'answering',
      wrongChoices: [],
      hint: false,
      touched: false,
      award: 0,
    }
  }
  if (state.phase !== 'answering') return next
  if (action.type === 'hint') {
    return {
      ...next,
      hint: true,
      touched: true,
      hints: state.hints + (state.hint ? 0 : 1),
    }
  }
  if (action.type === 'reveal') {
    return {
      ...next,
      phase: 'revealed',
      touched: true,
      completed: state.completed + 1,
      reveals: state.reveals + 1,
      points: state.points + 1,
      award: 1,
      streak: 0,
    }
  }
  if (action.type !== 'answer') return next
  const question = state.questions[state.index]!
  if (
    !question.choices.includes(action.value) ||
    state.wrongChoices.includes(action.value)
  )
    return next
  if (action.value !== question.answer) {
    return {
      ...next,
      touched: true,
      wrongChoices: [...state.wrongChoices, action.value],
      streak: 0,
    }
  }
  const independent = state.wrongChoices.length === 0 && !state.hint
  const streak = independent ? state.streak + 1 : 0
  const award = independent ? 10 + (streak % 3 === 0 ? 5 : 0) : 5
  return {
    ...next,
    phase: 'correct',
    touched: true,
    completed: state.completed + 1,
    solved: state.solved + 1,
    firstTry: state.firstTry + (independent ? 1 : 0),
    points: state.points + award,
    award,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
  }
}

export function countingStars(completed: number): number {
  return [2, 5, 8].filter((threshold) => completed >= threshold).length
}

export interface CountingSummary {
  timestamp: string
  step: CountingStep
  timer: CountingTimer
  attempted: number
  completed: number
  solved: number
  firstTry: number
  hints: number
  reveals: number
  points: number
  bestStreak: number
  durationSeconds: number
  endReason: NonNullable<CountingRound['endReason']>
}

export function summarizeCountingRound(state: CountingRound): CountingSummary {
  return {
    timestamp: new Date().toISOString(),
    step: state.settings.step,
    timer: state.settings.timer,
    attempted:
      state.completed + (state.phase === 'answering' && state.touched ? 1 : 0),
    completed: state.completed,
    solved: state.solved,
    firstTry: state.firstTry,
    hints: state.hints,
    reveals: state.reveals,
    points: state.points,
    bestStreak: state.bestStreak,
    durationSeconds: Math.floor(state.elapsedMs / 1000),
    endReason: state.endReason ?? 'ended',
  }
}
