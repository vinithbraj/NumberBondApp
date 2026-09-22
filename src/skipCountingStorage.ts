import {
  COUNTING_STEPS,
  ROUND_LENGTH,
  type CountingSettings,
  type CountingStep,
  type CountingSummary,
} from './domain/skipCounting'

export const COUNTING_STORAGE_KEY = 'number-bonds:skip-counting'
export interface CountingProgress {
  settings: CountingSettings
  sessions: CountingSummary[]
}

const defaults = (): CountingProgress => ({
  settings: { step: 5, timer: 0 },
  sessions: [],
})
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const stepIsValid = (value: unknown): value is CountingStep =>
  COUNTING_STEPS.some((step) => step === value)
const timerIsValid = (value: unknown) =>
  value === 0 || value === 120 || value === 180
const integer = (value: unknown, max: number): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= max

function summaryIsValid(value: unknown): value is CountingSummary {
  if (
    !record(value) ||
    !stepIsValid(value.step) ||
    !timerIsValid(value.timer) ||
    typeof value.timestamp !== 'string' ||
    !Number.isFinite(Date.parse(value.timestamp)) ||
    !['complete', 'timer', 'ended'].includes(String(value.endReason))
  )
    return false
  for (const key of [
    'attempted',
    'completed',
    'solved',
    'firstTry',
    'hints',
    'reveals',
    'bestStreak',
  ]) {
    if (!integer(value[key], ROUND_LENGTH)) return false
  }
  return (
    integer(value.points, 90) &&
    integer(value.durationSeconds, Number.MAX_SAFE_INTEGER) &&
    Number(value.firstTry) <= Number(value.solved) &&
    Number(value.solved) + Number(value.reveals) === value.completed &&
    Number(value.completed) <= Number(value.attempted)
  )
}

export function loadCountingProgress(): CountingProgress {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(COUNTING_STORAGE_KEY) ?? 'null',
    )
    if (!record(value) || value.version !== 1) return defaults()
    const settings =
      record(value.settings) &&
      stepIsValid(value.settings.step) &&
      timerIsValid(value.settings.timer)
        ? {
            step: value.settings.step,
            timer: value.settings.timer as CountingSettings['timer'],
          }
        : defaults().settings
    return {
      settings,
      sessions: Array.isArray(value.sessions)
        ? value.sessions.filter(summaryIsValid).slice(0, 10)
        : [],
    }
  } catch {
    return defaults()
  }
}

export function saveCountingProgress(progress: CountingProgress): void {
  try {
    localStorage.setItem(
      COUNTING_STORAGE_KEY,
      JSON.stringify({
        ...progress,
        sessions: progress.sessions.slice(0, 10),
        version: 1,
      }),
    )
  } catch {
    // Practice and rewards still work when the browser cannot save data.
  }
}
