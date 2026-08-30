import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  emptySessionBreakdown,
  recordQuestionResult,
} from './domain/performance'
import { PRESET_SETTINGS } from './domain/types'
import { installSpeechSynthesisMock } from './test/speechSynthesisMock'
import {
  addSessionSummary,
  loadSessionSummaries,
  loadSettings,
  saveSettings,
  setTutorialCompleted,
} from './storage'
import { loadVoicePreferences } from './voice'

function answerFromSentence(): string {
  const sentence = screen.getByLabelText('Number sentence').textContent ?? ''
  const match = sentence.match(/(\?|\d+)=(\?|\d+)\+(\?|\d+)/)
  if (!match) throw new Error(`Could not read number sentence: ${sentence}`)

  const [, whole, partA, partB] = match
  if (whole === '?') return String(Number(partA) + Number(partB))
  if (partA === '?') return String(Number(whole) - Number(partB))
  return String(Number(whole) - Number(partA))
}

function tenQuestionBreakdown() {
  let breakdown = emptySessionBreakdown()
  for (let index = 0; index < 10; index += 1) {
    breakdown = recordQuestionResult(breakdown, {
      whole: index < 5 ? 5 : 8,
      missingPosition: index % 2 === 0 ? 'whole' : 'partA',
      attempts: index < 8 ? 1 : 2,
      firstTry: index < 8,
      hintUsed: false,
      revealed: false,
      responseMs: 5_000,
    })
  }
  return breakdown
}

describe('App flow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'speechSynthesis')
  })

  it('shows the tutorial once and makes it replayable', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'A whole is made of two parts.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Choose a level' }))

    expect(screen.getByRole('heading', { name: 'Choose a practice level.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'How it works' }))
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('supports custom settings and the alternate diagram orientation', async () => {
    setTutorialCompleted(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Custom/ }))
    expect(screen.getByRole('heading', { name: 'Custom practice' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Largest whole'), '6')
    await user.selectOptions(screen.getByLabelText('What is missing?'), 'missing-part')
    await user.click(screen.getByRole('button', { name: 'Whole below' }))
    await user.click(screen.getByRole('button', { name: 'Start practice' }))

    expect(screen.getByRole('textbox', { name: /Missing part/ })).toBeInTheDocument()
    expect(screen.getByRole('figure')).toHaveClass('bond-diagram--whole-bottom')
  })

  it('completes a five-question session and saves its summary', async () => {
    setTutorialCompleted(true)
    saveSettings({ ...PRESET_SETTINGS.beginner, sessionLength: 5 })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start practice' }))

    for (let question = 0; question < 5; question += 1) {
      const input = screen.getByRole('textbox', { name: 'Missing whole' })
      await user.type(input, answerFromSentence())
      await user.click(screen.getByRole('button', { name: 'Check' }))
      await user.click(
        screen.getByRole('button', {
          name: question === 4 ? 'See my results' : 'Next question',
        }),
      )
    }

    expect(screen.getByRole('heading', { name: 'Wonderful number work!' })).toBeInTheDocument()
    const stats = screen.getByText('worked on').closest('div')
    expect(stats).not.toBeNull()
    expect(within(stats!).getByText('5')).toBeInTheDocument()
    expect(loadSessionSummaries()).toHaveLength(1)
    expect(loadSessionSummaries()[0]).toMatchObject({
      questionsCompleted: 5,
      firstAttemptCorrect: 5,
      points: 60,
      maxStreak: 5,
      endReason: 'questions',
    })
    expect(
      loadSessionSummaries()[0]?.breakdown.byType['missing-whole'],
    ).toMatchObject({ attempted: 5, solved: 5, firstTryCorrect: 5 })
  })

  it('lets an adult choose timed, unlimited, and adaptive practice', async () => {
    setTutorialCompleted(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Timed' }))
    expect(screen.getByRole('button', { name: '5 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: '3 min' }))
    await user.click(screen.getByRole('checkbox', { name: /Adaptive on/ }))

    expect(loadSettings()).toMatchObject({
      sessionLength: 'endless',
      sessionDurationMinutes: 3,
      adaptive: false,
    })

    await user.click(screen.getByRole('button', { name: 'Unlimited' }))
    expect(loadSettings()).toMatchObject({
      sessionLength: 'endless',
      sessionDurationMinutes: null,
    })
    expect(screen.getByText(/elapsed clock is shown/i)).toBeInTheDocument()
  })

  it('shows recent history and clears it only after confirmation', async () => {
    setTutorialCompleted(true)
    addSessionSummary({
      timestamp: '2026-08-30T12:00:00.000Z',
      settings: PRESET_SETTINGS.standard,
      questionsCompleted: 10,
      firstAttemptCorrect: 8,
      points: 92,
      maxStreak: 5,
      durationSeconds: 180,
      highestWhole: 10,
      adaptiveLevelUps: 1,
      endReason: 'questions',
      breakdown: tenQuestionBreakdown(),
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Parent report (1)' }))
    expect(
      screen.getByLabelText('8 of 10 first try, 92 points'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset progress' }))
    expect(screen.getByRole('heading', { name: 'No sessions yet' })).toBeInTheDocument()
    expect(loadSessionSummaries()).toHaveLength(0)
  })

  it('persists the selected teacher tone and installed voice', async () => {
    setTutorialCompleted(true)
    installSpeechSynthesisMock()
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('option', { name: /Samantha/ })
    await user.click(screen.getByRole('button', { name: /Cheerful/ }))
    await user.selectOptions(
      screen.getByLabelText('Choose a teacher voice'),
      'voice:samantha',
    )

    expect(loadVoicePreferences()).toEqual({
      enabled: true,
      tone: 'cheerful',
      voiceURI: 'voice:samantha',
    })
  })
})
