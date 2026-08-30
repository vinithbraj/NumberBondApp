import type {
  MetricBucket,
  MissingPosition,
  ProblemType,
  RangeBand,
  SessionBreakdown,
  SessionSummary,
} from './types'

const RANGE_BANDS: readonly RangeBand[] = ['1-5', '6-10', '11-20']
const PROBLEM_TYPES: readonly ProblemType[] = [
  'missing-whole',
  'missing-part',
]

const RANGE_LABELS: Readonly<Record<RangeBand, string>> = {
  '1-5': 'Numbers 1–5',
  '6-10': 'Numbers 6–10',
  '11-20': 'Numbers 11–20',
}

const TYPE_LABELS: Readonly<Record<ProblemType, string>> = {
  'missing-whole': 'Finding the whole',
  'missing-part': 'Finding a part',
}

/** Enough completed questions to describe an area as a pattern. */
export const MIN_INSIGHT_ATTEMPTS = 5
export const MIN_TREND_QUESTIONS = 5

export interface CompletedQuestionResult {
  whole: number
  missingPosition: MissingPosition
  attempts: number
  firstTry: boolean
  hintUsed: boolean
  revealed: boolean
  /** False records a submitted-but-unfinished question at session end. */
  solved?: boolean
  responseMs: number
}

export interface ReportRow<
  Key extends RangeBand | ProblemType = RangeBand | ProblemType,
> extends MetricBucket {
  key: Key
  label: string
  /** All rates are fractions from 0 to 1, or null when there is no sample. */
  firstTryRate: number | null
  solveRate: number | null
  averageAttempts: number | null
  averageResponseSeconds: number | null
  hintRate: number | null
  revealRate: number | null
}

export interface SkillInsight {
  dimension: 'range' | 'type'
  key: RangeBand | ProblemType
  label: string
  attempted: number
  /** A conservative blend of first-try accuracy and eventually solving it. */
  masteryScore: number
  firstTryRate: number
  solveRate: number
}

export type TrendDirection =
  | 'improving'
  | 'steady'
  | 'building'
  | 'not-enough-data'

export interface RecentTrend {
  direction: TrendDirection
  currentFirstTryRate: number | null
  previousFirstTryRate: number | null
  change: number | null
  currentSessionCount: number
  previousSessionCount: number
}

export interface ParentReport {
  sessions: number
  questions: number
  totalPoints: number
  totalPracticeSeconds: number
  firstTryRate: number | null
  solveRate: number | null
  averageAttempts: number | null
  averageResponseSeconds: number | null
  hintRate: number | null
  revealRate: number | null
  bestStreak: number
  highestWhole: number
  totalAdaptiveLevelUps: number
  rangeRows: ReportRow<RangeBand>[]
  typeRows: ReportRow<ProblemType>[]
  strongestArea: SkillInsight | null
  focusArea: SkillInsight | null
  recentTrend: RecentTrend
}

export function emptyMetricBucket(): MetricBucket {
  return {
    attempted: 0,
    solved: 0,
    firstTryCorrect: 0,
    hintsUsed: 0,
    reveals: 0,
    totalAttempts: 0,
    totalResponseMs: 0,
  }
}

export function emptySessionBreakdown(): SessionBreakdown {
  return {
    byRange: {
      '1-5': emptyMetricBucket(),
      '6-10': emptyMetricBucket(),
      '11-20': emptyMetricBucket(),
    },
    byType: {
      'missing-whole': emptyMetricBucket(),
      'missing-part': emptyMetricBucket(),
    },
  }
}

export function rangeBandForWhole(whole: number): RangeBand {
  if (whole >= 11) return '11-20'
  if (whole >= 6) return '6-10'
  return '1-5'
}

function problemTypeForMissing(missing: MissingPosition): ProblemType {
  return missing === 'whole' ? 'missing-whole' : 'missing-part'
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function completedAttempts(value: number): number {
  return Math.max(1, nonNegativeInteger(value))
}

function addQuestionToBucket(
  bucket: MetricBucket | undefined,
  result: CompletedQuestionResult,
): MetricBucket {
  const current = bucket ?? emptyMetricBucket()
  const solved = !result.revealed && (result.solved ?? true)
  const firstTryCorrect = solved && result.firstTry

  return {
    attempted: current.attempted + 1,
    solved: current.solved + Number(solved),
    firstTryCorrect: current.firstTryCorrect + Number(firstTryCorrect),
    hintsUsed: current.hintsUsed + Number(result.hintUsed),
    reveals: current.reveals + Number(result.revealed),
    totalAttempts: current.totalAttempts + completedAttempts(result.attempts),
    totalResponseMs:
      current.totalResponseMs + nonNegativeInteger(result.responseMs),
  }
}

/**
 * Add one submitted question to both report dimensions. Revealed and
 * session-ending unfinished questions are attempted but not solved by the
 * child. No per-answer data is retained.
 */
export function recordQuestionResult(
  breakdown: SessionBreakdown,
  result: CompletedQuestionResult,
): SessionBreakdown {
  const range = rangeBandForWhole(result.whole)
  const problemType = problemTypeForMissing(result.missingPosition)

  return {
    byRange: {
      ...breakdown.byRange,
      [range]: addQuestionToBucket(breakdown.byRange[range], result),
    },
    byType: {
      ...breakdown.byType,
      [problemType]: addQuestionToBucket(
        breakdown.byType[problemType],
        result,
      ),
    },
  }
}

function safeMetric(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function addBuckets(left: MetricBucket, right: MetricBucket): MetricBucket {
  return {
    attempted: left.attempted + safeMetric(right.attempted),
    solved: left.solved + safeMetric(right.solved),
    firstTryCorrect:
      left.firstTryCorrect + safeMetric(right.firstTryCorrect),
    hintsUsed: left.hintsUsed + safeMetric(right.hintsUsed),
    reveals: left.reveals + safeMetric(right.reveals),
    totalAttempts: left.totalAttempts + safeMetric(right.totalAttempts),
    totalResponseMs:
      left.totalResponseMs + safeMetric(right.totalResponseMs),
  }
}

function fraction(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.min(1, Math.max(0, numerator / denominator))
}

function average(total: number, count: number): number | null {
  if (count <= 0) return null
  return Math.max(0, total / count)
}

function reportRow<Key extends RangeBand | ProblemType>(
  key: Key,
  label: string,
  bucket: MetricBucket,
): ReportRow<Key> {
  return {
    key,
    label,
    ...bucket,
    firstTryRate: fraction(bucket.firstTryCorrect, bucket.attempted),
    solveRate: fraction(bucket.solved, bucket.attempted),
    averageAttempts: average(bucket.totalAttempts, bucket.attempted),
    averageResponseSeconds: average(
      bucket.totalResponseMs / 1000,
      bucket.attempted,
    ),
    hintRate: fraction(bucket.hintsUsed, bucket.attempted),
    revealRate: fraction(bucket.reveals, bucket.attempted),
  }
}

function aggregateDimension<Key extends RangeBand | ProblemType>(
  sessions: readonly SessionSummary[],
  keys: readonly Key[],
  select: (breakdown: SessionBreakdown) => Record<Key, MetricBucket>,
): Record<Key, MetricBucket> {
  return Object.fromEntries(
    keys.map((key) => {
      const bucket = sessions.reduce(
        (total, session) =>
          addBuckets(total, select(session.breakdown)[key]),
        emptyMetricBucket(),
      )
      return [key, bucket]
    }),
  ) as Record<Key, MetricBucket>
}

function sumBuckets(buckets: readonly MetricBucket[]): MetricBucket {
  return buckets.reduce(addBuckets, emptyMetricBucket())
}

function insightCandidates(
  rangeRows: readonly ReportRow<RangeBand>[],
  typeRows: readonly ReportRow<ProblemType>[],
): SkillInsight[] {
  return [
    ...rangeRows.map((row) => ({ dimension: 'range' as const, row })),
    ...typeRows.map((row) => ({ dimension: 'type' as const, row })),
  ]
    .filter(
      ({ row }) =>
        row.attempted >= MIN_INSIGHT_ATTEMPTS &&
        row.firstTryRate !== null &&
        row.solveRate !== null,
    )
    .map(({ dimension, row }) => ({
      dimension,
      key: row.key,
      label: row.label,
      attempted: row.attempted,
      masteryScore: row.firstTryRate! * 0.7 + row.solveRate! * 0.3,
      firstTryRate: row.firstTryRate!,
      solveRate: row.solveRate!,
    }))
}

function performanceInsights(
  rangeRows: readonly ReportRow<RangeBand>[],
  typeRows: readonly ReportRow<ProblemType>[],
): Pick<ParentReport, 'strongestArea' | 'focusArea'> {
  const candidates = insightCandidates(rangeRows, typeRows).sort(
    (left, right) => left.masteryScore - right.masteryScore,
  )

  if (candidates.length < 2) {
    return { strongestArea: null, focusArea: null }
  }

  const focusArea = candidates[0]!
  const strongestArea = candidates.at(-1)!

  // Small differences are normal variation, not a reliable learning pattern.
  if (strongestArea.masteryScore - focusArea.masteryScore < 0.05) {
    return { strongestArea: null, focusArea: null }
  }

  return { strongestArea, focusArea }
}

function firstTryRateForSessions(
  sessions: readonly SessionSummary[],
): number | null {
  const questions = sessions.reduce(
    (total, session) => total + questionsRepresentedBy(session),
    0,
  )
  const firstTry = sessions.reduce(
    (total, session) => total + safeMetric(session.firstAttemptCorrect),
    0,
  )
  return fraction(firstTry, questions)
}

function questionCountForSessions(
  sessions: readonly SessionSummary[],
): number {
  return sessions.reduce(
    (total, session) => total + questionsRepresentedBy(session),
    0,
  )
}

function detailedQuestionsFor(session: SessionSummary): number {
  return PROBLEM_TYPES.reduce(
    (total, type) =>
      total + safeMetric(session.breakdown.byType[type].attempted),
    0,
  )
}

function questionsRepresentedBy(session: SessionSummary): number {
  const detailed = detailedQuestionsFor(session)
  return detailed > 0 ? detailed : safeMetric(session.questionsCompleted)
}

function timestampValue(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : 0
}

function recentTrend(sessions: readonly SessionSummary[]): RecentTrend {
  const completedSessions = sessions
    .filter((session) => questionsRepresentedBy(session) > 0)
    .map((session, index) => ({ session, index }))
    .sort(
      (left, right) =>
        timestampValue(right.session.timestamp) -
          timestampValue(left.session.timestamp) || left.index - right.index,
    )
    .map(({ session }) => session)

  if (completedSessions.length === 0) {
    return {
      direction: 'not-enough-data',
      currentFirstTryRate: null,
      previousFirstTryRate: null,
      change: null,
      currentSessionCount: 0,
      previousSessionCount: 0,
    }
  }

  const currentCount = Math.min(
    3,
    Math.max(1, completedSessions.length - 1),
  )
  const current = completedSessions.slice(0, currentCount)
  const previous = completedSessions.slice(currentCount, currentCount + 3)
  const currentFirstTryRate = firstTryRateForSessions(current)
  const previousFirstTryRate = firstTryRateForSessions(previous)
  const hasEnoughQuestions =
    questionCountForSessions(current) >= MIN_TREND_QUESTIONS &&
    questionCountForSessions(previous) >= MIN_TREND_QUESTIONS

  if (
    currentFirstTryRate === null ||
    previousFirstTryRate === null ||
    !hasEnoughQuestions
  ) {
    return {
      direction: 'not-enough-data',
      currentFirstTryRate,
      previousFirstTryRate,
      change: null,
      currentSessionCount: current.length,
      previousSessionCount: previous.length,
    }
  }

  const change = currentFirstTryRate - previousFirstTryRate
  const direction: TrendDirection =
    change >= 0.05 ? 'improving' : change <= -0.05 ? 'building' : 'steady'

  return {
    direction,
    currentFirstTryRate,
    previousFirstTryRate,
    change,
    currentSessionCount: current.length,
    previousSessionCount: previous.length,
  }
}

/** Build an aggregate-only parent report from the retained session summaries. */
export function buildParentReport(
  sessions: readonly SessionSummary[],
): ParentReport {
  const byRange = aggregateDimension(
    sessions,
    RANGE_BANDS,
    (breakdown) => breakdown.byRange,
  )
  const byType = aggregateDimension(
    sessions,
    PROBLEM_TYPES,
    (breakdown) => breakdown.byType,
  )
  const rangeRows = RANGE_BANDS.map((key) =>
    reportRow(key, RANGE_LABELS[key], byRange[key]),
  )
  const typeRows = PROBLEM_TYPES.map((key) =>
    reportRow(key, TYPE_LABELS[key], byType[key]),
  )

  // Each question belongs to exactly one type, so this dimension is the
  // canonical source for totals and cannot double-count an answer.
  const metricTotals = sumBuckets(PROBLEM_TYPES.map((key) => byType[key]))
  const questions = sessions.reduce(
    (total, session) => total + questionsRepresentedBy(session),
    0,
  )
  const firstTryCorrect = sessions.reduce(
    (total, session) => total + safeMetric(session.firstAttemptCorrect),
    0,
  )
  const insights = performanceInsights(rangeRows, typeRows)

  return {
    sessions: sessions.length,
    questions,
    totalPoints: sessions.reduce(
      (total, session) => total + safeMetric(session.points),
      0,
    ),
    totalPracticeSeconds: sessions.reduce(
      (total, session) => total + safeMetric(session.durationSeconds),
      0,
    ),
    firstTryRate: fraction(firstTryCorrect, questions),
    solveRate: fraction(metricTotals.solved, metricTotals.attempted),
    averageAttempts: average(
      metricTotals.totalAttempts,
      metricTotals.attempted,
    ),
    averageResponseSeconds: average(
      metricTotals.totalResponseMs / 1000,
      metricTotals.attempted,
    ),
    hintRate: fraction(metricTotals.hintsUsed, metricTotals.attempted),
    revealRate: fraction(metricTotals.reveals, metricTotals.attempted),
    bestStreak: sessions.reduce(
      (best, session) => Math.max(best, safeMetric(session.maxStreak)),
      0,
    ),
    highestWhole: sessions.reduce(
      (highest, session) => Math.max(highest, safeMetric(session.highestWhole)),
      0,
    ),
    totalAdaptiveLevelUps: sessions.reduce(
      (total, session) => total + safeMetric(session.adaptiveLevelUps),
      0,
    ),
    rangeRows,
    typeRows,
    ...insights,
    recentTrend: recentTrend(sessions),
  }
}
