/** The result of one question, expressed independently of UI state. */
export interface ScoringOutcome {
  /** One-based attempt number: 1 means the child solved it on the first try. */
  attemptNumber: number
  /** True when the app supplied the answer instead of the child solving it. */
  revealed: boolean
}

export interface QuestionScore {
  points: number
  basePoints: number
  streakBonus: number
  newStreak: number
  label: string
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function normalizedAttemptNumber(value: number): number {
  // Invalid input receives the lowest solved-question base rather than an
  // accidental first-try bonus.
  if (!Number.isFinite(value) || value < 1) return 3
  return Math.floor(value)
}

/**
 * Award a small, game-like score without ever taking points away. A streak is
 * any run of questions solved without revealing the answer. Its bonus begins
 * on the second solve and is capped so the arithmetic remains easy to explain.
 */
export function scoreQuestion(
  outcome: ScoringOutcome,
  currentStreak = 0,
): QuestionScore {
  const streak = nonNegativeInteger(currentStreak)

  if (outcome.revealed) {
    return {
      points: 1,
      basePoints: 1,
      streakBonus: 0,
      newStreak: 0,
      label: 'Good learning!',
    }
  }

  const attemptNumber = normalizedAttemptNumber(outcome.attemptNumber)
  const basePoints = attemptNumber === 1 ? 10 : attemptNumber === 2 ? 7 : 4
  const newStreak = streak + 1
  const streakBonus = Math.min(5, Math.max(0, newStreak - 1))

  let label = 'You kept going!'
  if (newStreak >= 3) label = `${newStreak} in a row!`
  else if (attemptNumber === 1) label = 'Great first try!'
  else if (attemptNumber === 2) label = 'Nice thinking!'

  return {
    points: Math.max(0, basePoints + streakBonus),
    basePoints,
    streakBonus,
    newStreak,
    label,
  }
}
