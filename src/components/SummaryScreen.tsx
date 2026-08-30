import type { SessionSummary } from '../domain/types'
import { AppHeader } from './AppHeader'

interface SummaryScreenProps {
  summary: SessionSummary
  onPracticeAgain: () => void
  onChangeSettings: () => void
  onProgress: () => void
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function SummaryScreen({
  summary,
  onPracticeAgain,
  onChangeSettings,
  onProgress,
}: SummaryScreenProps) {
  const detailedAttempts =
    summary.breakdown.byType['missing-whole'].attempted +
    summary.breakdown.byType['missing-part'].attempted
  const questionsAttempted = Math.max(
    summary.questionsCompleted,
    detailedAttempts,
  )
  const neededMoreThinking =
    questionsAttempted - summary.firstAttemptCorrect
  const completionMessage =
    summary.endReason === 'timer'
      ? 'Time is up, and you did wonderful number work!'
      : 'Wonderful number work!'

  return (
    <div className="page-shell">
      <AppHeader />
      <main className="summary-card">
        <div className="summary-bloom" aria-hidden="true">
          <span>●</span>
          <span>●</span>
          <span>●</span>
          <span>●</span>
          <strong>★</strong>
        </div>
        <p className="eyebrow">Practice complete</p>
        <h1>{completionMessage}</h1>
        <p className="lead-copy">
          You kept thinking and worked on {questionsAttempted}{' '}
          {questionsAttempted === 1 ? 'number bond' : 'number bonds'}.
          {questionsAttempted > summary.questionsCompleted &&
            ' The last one can wait until next time.'}
        </p>

        <div className="score-celebration" aria-label={`${summary.points} points earned`}>
          <span aria-hidden="true">★</span>
          <strong>{summary.points}</strong>
          <small>points earned</small>
        </div>

        {summary.adaptiveLevelUps > 0 && (
          <p className="level-up-summary">
            You unlocked bigger numbers {summary.adaptiveLevelUps}{' '}
            {summary.adaptiveLevelUps === 1 ? 'time' : 'times'}!
          </p>
        )}

        <div className="summary-stats">
          <div>
            <strong>{questionsAttempted}</strong>
            <span>worked on</span>
          </div>
          <div>
            <strong>{summary.firstAttemptCorrect}</strong>
            <span>first try</span>
          </div>
          <div>
            <strong>{neededMoreThinking}</strong>
            <span>kept trying</span>
          </div>
          <div>
            <strong>{summary.maxStreak}</strong>
            <span>best streak</span>
          </div>
          <div>
            <strong>{formatDuration(summary.durationSeconds)}</strong>
            <span>practice time</span>
          </div>
        </div>

        <div className="summary-actions">
          <button className="button button--primary button--large" type="button" onClick={onPracticeAgain}>
            Practice again
          </button>
          <button className="button button--secondary" type="button" onClick={onChangeSettings}>
            Change settings
          </button>
          <button className="text-button" type="button" onClick={onProgress}>
            Parent report
          </button>
        </div>
      </main>
    </div>
  )
}
