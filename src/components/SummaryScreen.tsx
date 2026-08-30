import type { SessionSummary } from '../domain/types'
import { AppHeader } from './AppHeader'

interface SummaryScreenProps {
  summary: SessionSummary
  onPracticeAgain: () => void
  onChangeSettings: () => void
  onProgress: () => void
}

export function SummaryScreen({
  summary,
  onPracticeAgain,
  onChangeSettings,
  onProgress,
}: SummaryScreenProps) {
  const missedFirstTry =
    summary.questionsCompleted - summary.firstAttemptCorrect

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
        <h1>Wonderful number work!</h1>
        <p className="lead-copy">
          You kept thinking and finished {summary.questionsCompleted}{' '}
          {summary.questionsCompleted === 1 ? 'number bond' : 'number bonds'}.
        </p>

        <div className="summary-stats">
          <div>
            <strong>{summary.questionsCompleted}</strong>
            <span>completed</span>
          </div>
          <div>
            <strong>{summary.firstAttemptCorrect}</strong>
            <span>first try</span>
          </div>
          <div>
            <strong>{missedFirstTry}</strong>
            <span>kept trying</span>
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
            See progress
          </button>
        </div>
      </main>
    </div>
  )
}
