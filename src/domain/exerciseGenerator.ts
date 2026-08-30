import type {
  BondExercise,
  ExerciseMode,
  MissingPosition,
  PracticeSettings,
} from './types'
import { MAX_WHOLE, MIN_WHOLE } from './types'

export type RandomSource = () => number

/**
 * The queue is finite even for an endless session. The practice screen can ask
 * for another batch as it approaches the end of the current one.
 */
export const DEFAULT_ENDLESS_BATCH_SIZE = 20

function randomIndex(length: number, random: RandomSource): number {
  if (length <= 1) return 0

  const value = random()
  if (!Number.isFinite(value)) return 0

  return Math.min(length - 1, Math.max(0, Math.floor(value * length)))
}

function sanitizedWholeRange(settings: PracticeSettings): [number, number] {
  const first = Number.isFinite(settings.minWhole)
    ? Math.min(MAX_WHOLE, Math.max(MIN_WHOLE, Math.floor(settings.minWhole)))
    : MIN_WHOLE
  const second = Number.isFinite(settings.maxWhole)
    ? Math.min(MAX_WHOLE, Math.max(MIN_WHOLE, Math.floor(settings.maxWhole)))
    : first
  return first <= second ? [first, second] : [second, first]
}

function missingPositionsForMode(mode: ExerciseMode): MissingPosition[] {
  if (mode === 'missing-whole') return ['whole']
  if (mode === 'missing-part') return ['partA', 'partB']
  return ['whole', 'partA', 'partB']
}

/** Build every valid question once. Generation selects from this finite pool. */
export function buildExercisePool(settings: PracticeSettings): BondExercise[] {
  const [minWhole, maxWhole] = sanitizedWholeRange(settings)
  const missingPositions = missingPositionsForMode(settings.exerciseMode)
  const exercises: BondExercise[] = []

  for (let whole = minWhole; whole <= maxWhole; whole += 1) {
    const minimumPart = settings.zeroPolicy === 'allow' ? 0 : 1
    const maximumPart = settings.zeroPolicy === 'allow' ? whole : whole - 1

    for (let partA = minimumPart; partA <= maximumPart; partA += 1) {
      const partB = whole - partA

      // A whole of 1 has no decomposition with two positive parts.
      if (partB < minimumPart) continue

      for (const missing of missingPositions) {
        exercises.push({ whole, parts: [partA, partB], missing })
      }
    }
  }

  return exercises
}

export function correctAnswer(exercise: BondExercise): number {
  if (exercise.missing === 'whole') return exercise.whole
  return exercise.missing === 'partA' ? exercise.parts[0] : exercise.parts[1]
}

export function isCorrectAnswer(
  exercise: BondExercise,
  answer: number,
): boolean {
  return Number.isInteger(answer) && answer === correctAnswer(exercise)
}

export function isZeroBond(exercise: BondExercise): boolean {
  return exercise.parts[0] === 0 || exercise.parts[1] === 0
}

/**
 * Swapped parts represent the same bond for repetition purposes. Missing part A
 * and missing part B are likewise the same prompt when their displayed values
 * are mirror images.
 */
export function exerciseKey(exercise: BondExercise): string {
  const lowPart = Math.min(...exercise.parts)
  const highPart = Math.max(...exercise.parts)
  const missingKind = exercise.missing === 'whole' ? 'whole' : 'part'
  const answer = correctAnswer(exercise)
  return `${exercise.whole}:${lowPart}:${highPart}:${missingKind}:${answer}`
}

function chooseFromPool(
  candidates: readonly BondExercise[],
  previous: BondExercise | undefined,
  random: RandomSource,
): BondExercise | undefined {
  if (candidates.length === 0) return undefined

  let allowed = candidates

  if (previous && isZeroBond(previous)) {
    const nonZero = allowed.filter((candidate) => !isZeroBond(candidate))
    if (nonZero.length > 0) allowed = nonZero
  }

  if (previous) {
    const previousKey = exerciseKey(previous)
    const nonDuplicates = allowed.filter(
      (candidate) => exerciseKey(candidate) !== previousKey,
    )
    if (nonDuplicates.length > 0) allowed = nonDuplicates
  }

  return allowed[randomIndex(allowed.length, random)]
}

function balancedMissingPositions(
  mode: ExerciseMode,
  count: number,
  random: RandomSource,
): MissingPosition[] {
  if (mode === 'missing-whole') return Array(count).fill('whole')

  const firstPart: MissingPosition =
    randomIndex(2, random) === 0 ? 'partA' : 'partB'
  let partCount = 0
  const nextPart = (): MissingPosition => {
    const position =
      partCount % 2 === 0
        ? firstPart
        : firstPart === 'partA'
          ? 'partB'
          : 'partA'
    partCount += 1
    return position
  }

  if (mode === 'missing-part') {
    return Array.from({ length: count }, nextPart)
  }

  const first = randomIndex(2, random) === 0 ? 'whole' : 'part'
  return Array.from({ length: count }, (_, index) => {
    const kind =
      index % 2 === 0 ? first : first === 'whole' ? 'part' : 'whole'
    return kind === 'whole' ? 'whole' : nextPart()
  })
}

/**
 * Generate a deterministic queue when supplied a deterministic random source.
 * Mixed queues alternate missing-whole and missing-part prompts, so their
 * counts differ by at most one. Constraints that are impossible for a tiny
 * pool (for example, only zero bonds) degrade gracefully instead of retrying.
 */
export function generateExerciseQueue(
  settings: PracticeSettings,
  requestedCount: number =
    settings.sessionLength === 'endless'
      ? DEFAULT_ENDLESS_BATCH_SIZE
      : settings.sessionLength,
  random: RandomSource = Math.random,
): BondExercise[] {
  const count = Math.max(0, Math.floor(requestedCount))
  if (count === 0) return []

  const pool = buildExercisePool(settings)
  if (pool.length === 0) return []

  const missingPositions = balancedMissingPositions(
    settings.exerciseMode,
    count,
    random,
  )
  const queue: BondExercise[] = []

  for (const position of missingPositions) {
    const preferredPool = pool.filter(
      (exercise) => exercise.missing === position,
    )
    const selected = chooseFromPool(
      preferredPool.length > 0 ? preferredPool : pool,
      queue.at(-1),
      random,
    )

    if (selected) queue.push(selected)
  }

  return queue
}

/** Generate a single valid exercise using the same selection rules. */
export function generateExercise(
  settings: PracticeSettings,
  random: RandomSource = Math.random,
): BondExercise | undefined {
  return chooseFromPool(buildExercisePool(settings), undefined, random)
}
