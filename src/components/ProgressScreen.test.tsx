import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  emptySessionBreakdown,
  recordQuestionResult,
} from '../domain/performance'
import { PRESET_SETTINGS, type SessionSummary } from '../domain/types'
import { ProgressScreen } from './ProgressScreen'

function reportSummary(): SessionSummary {
  let breakdown = emptySessionBreakdown()

  for (let index = 0; index < 6; index += 1) {
    breakdown = recordQuestionResult(breakdown, {
      whole: 4,
      missingPosition: 'whole',
      attempts: 1,
      firstTry: true,
      hintUsed: false,
      revealed: false,
      responseMs: 4_000,
    })
    breakdown = recordQuestionResult(breakdown, {
      whole: 14,
      missingPosition: 'partA',
      attempts: 3,
      firstTry: false,
      hintUsed: true,
      revealed: true,
      responseMs: 18_000,
    })
  }

  return {
    timestamp: '2026-08-30T12:00:00.000Z',
    settings: PRESET_SETTINGS.challenge,
    questionsCompleted: 12,
    firstAttemptCorrect: 6,
    points: 72,
    maxStreak: 6,
    durationSeconds: 132,
    highestWhole: 14,
    adaptiveLevelUps: 2,
    endReason: 'questions',
    breakdown,
  }
}

describe('ProgressScreen', () => {
  it('shows an aggregate parent report with range and problem-type focus', () => {
    render(
      <ProgressScreen
        sessions={[reportSummary()]}
        onBack={() => undefined}
        onClear={() => undefined}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Learning report' })).toBeInTheDocument()
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('2m 12s')).toBeInTheDocument()
    expect(screen.getByText('Numbers 11–20', { selector: 'strong' })).toBeInTheDocument()

    const highRangeRow = screen.getByRole('row', { name: /Numbers 11–20/ })
    expect(within(highRangeRow).getByText('Practice next')).toBeInTheDocument()
    expect(within(highRangeRow).getAllByText('0%')).toHaveLength(2)

    expect(screen.getByRole('row', { name: /Finding a part/ })).toBeInTheDocument()
    expect(screen.getByText('14', { selector: 'dd' })).toBeInTheDocument()
    expect(
      screen.getByLabelText('6 of 12 first try, 72 points'),
    ).toBeInTheDocument()
  })

  it('keeps reset explicit and handles an empty report', async () => {
    const onClear = vi.fn()
    const { rerender } = render(
      <ProgressScreen
        sessions={[reportSummary()]}
        onBack={() => undefined}
        onClear={onClear}
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Reset progress' }))
    expect(onClear).toHaveBeenCalledOnce()

    rerender(
      <ProgressScreen
        sessions={[]}
        onBack={() => undefined}
        onClear={onClear}
      />,
    )
    expect(screen.getByRole('heading', { name: 'No sessions yet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset progress' })).not.toBeInTheDocument()
  })

  it('labels migrated sessions when detailed metrics were not recorded', () => {
    const legacy: SessionSummary = {
      ...reportSummary(),
      questionsCompleted: 10,
      firstAttemptCorrect: 8,
      points: 0,
      maxStreak: 0,
      durationSeconds: 0,
      highestWhole: 0,
      adaptiveLevelUps: 0,
      breakdown: emptySessionBreakdown(),
    }

    render(
      <ProgressScreen
        sessions={[legacy]}
        onBack={() => undefined}
        onClear={() => undefined}
      />,
    )

    expect(screen.getByText(/earlier session has first-try totals only/i)).toBeInTheDocument()
    expect(screen.getByText(/Earlier session details unavailable/)).toBeInTheDocument()
    expect(
      screen.getByLabelText(
        '8 of 10 first try, detailed score unavailable',
      ),
    ).toBeInTheDocument()
  })
})
