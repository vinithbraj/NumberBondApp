import type { SessionSummary } from '../domain/types'
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

export function ProgressScreen({
  sessions,
  onBack,
  onClear,
}: ProgressScreenProps) {
  return (
    <div className="page-shell">
      <AppHeader
        action={
          <button className="text-button" type="button" onClick={onBack}>
            Back
          </button>
        }
      />
      <main className="progress-page">
        <div className="section-heading">
          <div>
            <p className="eyebrow">On this device</p>
            <h1>Recent practice</h1>
            <p className="lead-copy">The latest 10 sessions stay only in this browser.</p>
          </div>
          {sessions.length > 0 && (
            <button className="text-button text-button--danger" type="button" onClick={onClear}>
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
            <p>Finish some number bonds and your practice will appear here.</p>
            <button className="button button--primary" type="button" onClick={onBack}>
              Start practicing
            </button>
          </section>
        ) : (
          <ol className="session-list">
            {sessions.map((session) => (
              <li className="session-card" key={`${session.timestamp}-${session.questionsCompleted}`}>
                <div>
                  <strong>{labelForPreset(session.settings.preset)}</strong>
                  <span>
                    Wholes {session.settings.minWhole}–{session.settings.maxWhole}
                  </span>
                  <time dateTime={session.timestamp}>
                    {formatSessionDate(session.timestamp)}
                  </time>
                </div>
                <div className="session-card__result">
                  <strong>
                    {session.firstAttemptCorrect}/{session.questionsCompleted}
                  </strong>
                  <span>first try</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  )
}
