import {
  buildParentReport,
  type ParentReport,
  type RecentTrend,
  type ReportRow,
} from '../domain/performance'
import type {
  ProblemType,
  RangeBand,
  SessionSummary,
} from '../domain/types'
import { AppHeader } from './AppHeader'

interface ProgressScreenProps {
  sessions: SessionSummary[]
  onBack: () => void
  onClear: () => void
}

function labelForPreset(preset: SessionSummary['settings']['preset']): string {
  return preset.charAt(0).toUpperCase() + preset.slice(1)
}

function formatSessionDate(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes === 0) return `${remainder}s`
  if (remainder === 0) return `${minutes}m`
  return `${minutes}m ${remainder}s`
}

function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

function formatDecimal(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value.toFixed(1)}${suffix}`
}

function trendCopy(trend: RecentTrend): string {
  if (trend.direction === 'not-enough-data') {
    return 'Finish a few more sessions to see a recent learning trend.'
  }
  if (trend.direction === 'improving') {
    return `The recent first-try rate is ${Math.round((trend.change ?? 0) * 100)} percentage points higher. Different ranges can also affect this number.`
  }
  if (trend.direction === 'building') {
    return 'The recent first-try rate is lower. This can happen when adaptive practice introduces harder numbers.'
  }
  return 'First-try accuracy is steady across recent sessions.'
}

function detailedQuestionsIn(session: SessionSummary): number {
  return (
    session.breakdown.byType['missing-whole'].attempted +
    session.breakdown.byType['missing-part'].attempted
  )
}

function questionsIn(session: SessionSummary): number {
  return Math.max(session.questionsCompleted, detailedQuestionsIn(session))
}

function hasDetailedMetrics(session: SessionSummary): boolean {
  return detailedQuestionsIn(session) > 0 || session.questionsCompleted === 0
}

function endReasonLabel(reason: SessionSummary['endReason']): string {
  if (reason === 'timer') return 'Timed session'
  if (reason === 'ended') return 'Ended early'
  return 'Question goal reached'
}

function insightMatches(
  report: ParentReport,
  kind: 'focus' | 'strongest',
  key: RangeBand | ProblemType,
): boolean {
  const insight = kind === 'focus' ? report.focusArea : report.strongestArea
  return insight?.key === key
}

function MetricTable<Key extends RangeBand | ProblemType>({
  rows,
  report,
}: {
  rows: ReportRow<Key>[]
  report: ParentReport
}) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Questions</th>
            <th scope="col">First try</th>
            <th scope="col">Solved</th>
            <th scope="col">Avg. time</th>
            <th scope="col">Hint shown</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.attempted === 0 ? 'report-row--empty' : ''}>
              <th scope="row">
                {row.label}
                {insightMatches(report, 'focus', row.key) && (
                  <span className="metric-tag metric-tag--focus">Practice next</span>
                )}
                {insightMatches(report, 'strongest', row.key) && (
                  <span className="metric-tag metric-tag--strong">Strength</span>
                )}
              </th>
              <td>{row.attempted}</td>
              <td>{formatRate(row.firstTryRate)}</td>
              <td>{formatRate(row.solveRate)}</td>
              <td>{formatDecimal(row.averageResponseSeconds, 's')}</td>
              <td>{formatRate(row.hintRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ProgressScreen({
  sessions,
  onBack,
  onClear,
}: ProgressScreenProps) {
  const report = buildParentReport(sessions)
  const legacySessionCount = sessions.filter(
    (session) => !hasDetailedMetrics(session),
  ).length
  const hasDetailedHistory = legacySessionCount < sessions.length

  return (
    <div className="page-shell">
      <AppHeader
        action={
          <button className="text-button" type="button" onClick={onBack}>
            Back
          </button>
        }
      />
      <main className="progress-page report-page">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Parent report · On this device</p>
            <h1>Learning report</h1>
            <p className="lead-copy">
              An aggregate view of the latest 10 sessions. No name or individual answer history is stored.
            </p>
          </div>
          {sessions.length > 0 && (
            <button
              className="text-button text-button--danger"
              type="button"
              onClick={onClear}
            >
              Reset progress
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <section className="empty-card">
            <span className="empty-card__icon" aria-hidden="true">
              ○—○
            </span>
            <h2>No sessions yet</h2>
            <p>Finish some number bonds and the parent report will appear here.</p>
            <button
              className="button button--primary"
              type="button"
              onClick={onBack}
            >
              Start practicing
            </button>
          </section>
        ) : (
          <>
            <section className="report-overview" aria-label="Report overview">
              <div>
                <strong>{report.sessions}</strong>
                <span>sessions</span>
              </div>
              <div>
                <strong>{report.questions}</strong>
                <span>questions practiced</span>
              </div>
              <div>
                <strong>
                  {hasDetailedHistory
                    ? formatDuration(report.totalPracticeSeconds)
                    : '—'}
                </strong>
                <span>elapsed practice time</span>
              </div>
              <div>
                <strong>{hasDetailedHistory ? report.totalPoints : '—'}</strong>
                <span>points earned</span>
              </div>
              <div>
                <strong>{formatRate(report.firstTryRate)}</strong>
                <span>first try</span>
              </div>
              <div>
                <strong>{formatRate(report.solveRate)}</strong>
                <span>solved without reveal</span>
              </div>
            </section>

            {legacySessionCount > 0 && (
              <p className="report-data-note">
                {legacySessionCount} earlier{' '}
                {legacySessionCount === 1 ? 'session has' : 'sessions have'}{' '}
                first-try totals only. Points, time, streak, adaptive, support, range, and type details below cover sessions recorded after the report update.
              </p>
            )}

            <section className="report-section" aria-labelledby="insights-heading">
              <div className="report-section__heading">
                <div>
                  <p className="eyebrow">Useful patterns</p>
                  <h2 id="insights-heading">What the recent practice shows</h2>
                </div>
                <span className="sample-note">Patterns need at least 5 questions</span>
              </div>
              <div className="insight-grid">
                <article className="insight-card insight-card--strong">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <small>Growing strength</small>
                    <strong>
                      {report.strongestArea?.label ?? 'Still collecting practice'}
                    </strong>
                    <p>
                      {report.strongestArea
                        ? `${formatRate(report.strongestArea.firstTryRate)} first try across ${report.strongestArea.attempted} questions.`
                        : 'More answers will make strengths easier to identify.'}
                    </p>
                  </div>
                </article>
                <article className="insight-card insight-card--focus">
                  <span aria-hidden="true">→</span>
                  <div>
                    <small>Practice next</small>
                    <strong>
                      {report.focusArea?.label ?? 'Keep using the chosen range'}
                    </strong>
                    <p>
                      {report.focusArea
                        ? `${formatRate(report.focusArea.firstTryRate)} first try across ${report.focusArea.attempted} questions. A short focused session may help.`
                        : 'No clear focus area yet—continue with short, relaxed sessions.'}
                    </p>
                  </div>
                </article>
                <article className="insight-card insight-card--trend">
                  <span aria-hidden="true">↗</span>
                  <div>
                    <small>Recent trend</small>
                    <strong>
                      {report.recentTrend.direction === 'improving'
                        ? 'Recent first-try rate is higher'
                        : report.recentTrend.direction === 'steady'
                          ? 'Practice is steady'
                          : report.recentTrend.direction === 'building'
                            ? 'Recent first-try rate is lower'
                            : 'More sessions needed'}
                    </strong>
                    <p>{trendCopy(report.recentTrend)}</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="report-section" aria-labelledby="range-heading">
              <div className="report-section__heading">
                <div>
                  <p className="eyebrow">Difficulty detail</p>
                  <h2 id="range-heading">Performance by number range</h2>
                </div>
              </div>
              <MetricTable rows={report.rangeRows} report={report} />
            </section>

            <section className="report-section" aria-labelledby="type-heading">
              <div className="report-section__heading">
                <div>
                  <p className="eyebrow">Problem detail</p>
                  <h2 id="type-heading">Performance by question type</h2>
                </div>
              </div>
              <MetricTable rows={report.typeRows} report={report} />
            </section>

            <section className="report-section" aria-labelledby="habits-heading">
              <div className="report-section__heading">
                <div>
                  <p className="eyebrow">Practice habits</p>
                  <h2 id="habits-heading">Support and persistence</h2>
                </div>
              </div>
              <dl className="habit-grid">
                <div>
                  <dt>Average attempts</dt>
                  <dd>{formatDecimal(report.averageAttempts)}</dd>
                </div>
                <div>
                  <dt>Average elapsed time per attempted question</dt>
                  <dd>{formatDecimal(report.averageResponseSeconds, 's')}</dd>
                </div>
                <div>
                  <dt>Questions shown a counting hint</dt>
                  <dd>{formatRate(report.hintRate)}</dd>
                </div>
                <div>
                  <dt>Answers revealed</dt>
                  <dd>{formatRate(report.revealRate)}</dd>
                </div>
                <div>
                  <dt>Best solved streak</dt>
                  <dd>{hasDetailedHistory ? report.bestStreak : '—'}</dd>
                </div>
                <div>
                  <dt>Highest whole practiced</dt>
                  <dd>{hasDetailedHistory ? report.highestWhole : '—'}</dd>
                </div>
                <div>
                  <dt>Adaptive level-ups</dt>
                  <dd>
                    {hasDetailedHistory ? report.totalAdaptiveLevelUps : '—'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="report-section" aria-labelledby="recent-heading">
              <div className="report-section__heading">
                <div>
                  <p className="eyebrow">Latest 10</p>
                  <h2 id="recent-heading">Recent sessions</h2>
                </div>
              </div>
              <ol className="session-list">
                {sessions.map((session) => (
                  <li
                    className="session-card"
                    key={`${session.timestamp}-${session.questionsCompleted}`}
                  >
                    <div>
                      <strong>{labelForPreset(session.settings.preset)}</strong>
                      <span>
                        Selected range {session.settings.minWhole}–{session.settings.maxWhole}
                        {hasDetailedMetrics(session)
                          ? ` · Highest practiced ${session.highestWhole} · ${endReasonLabel(session.endReason)}`
                          : ' · Earlier session details unavailable'}
                      </span>
                      <time dateTime={session.timestamp}>
                        {formatSessionDate(session.timestamp)}
                        {hasDetailedMetrics(session) &&
                          ` · ${formatDuration(session.durationSeconds)}`}
                      </time>
                    </div>
                    <div
                      className="session-card__result"
                      aria-label={`${session.firstAttemptCorrect} of ${questionsIn(session)} first try${
                        hasDetailedMetrics(session)
                          ? `, ${session.points} points`
                          : ', detailed score unavailable'
                      }`}
                    >
                      <strong>
                        {hasDetailedMetrics(session)
                          ? `${session.points} pts`
                          : 'Earlier'}
                      </strong>
                      <span>
                        {session.firstAttemptCorrect}/{questionsIn(session)}{' '}
                        first try
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
