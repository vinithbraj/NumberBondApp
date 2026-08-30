import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { PRESET_SETTINGS } from './domain/types'
import {
  addSessionSummary,
  loadSessionSummaries,
  saveSettings,
  setTutorialCompleted,
} from './storage'

function answerFromSentence(): string {
  const sentence = screen.getByLabelText('Number sentence').textContent ?? ''
  const match = sentence.match(/(\?|\d+)=(\?|\d+)\+(\?|\d+)/)
  if (!match) throw new Error(`Could not read number sentence: ${sentence}`)

  const [, whole, partA, partB] = match
  if (whole === '?') return String(Number(partA) + Number(partB))
  if (partA === '?') return String(Number(whole) - Number(partB))
  return String(Number(whole) - Number(partA))
}

describe('App flow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    const stats = screen.getByText('completed').closest('div')
    expect(stats).not.toBeNull()
    expect(within(stats!).getByText('5')).toBeInTheDocument()
    expect(loadSessionSummaries()).toHaveLength(1)
    expect(loadSessionSummaries()[0]).toMatchObject({
      questionsCompleted: 5,
      firstAttemptCorrect: 5,
    })
  })

  it('shows recent history and clears it only after confirmation', async () => {
    setTutorialCompleted(true)
    addSessionSummary({
      timestamp: '2026-08-30T12:00:00.000Z',
      settings: PRESET_SETTINGS.standard,
      questionsCompleted: 10,
      firstAttemptCorrect: 8,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Progress (1)' }))
    expect(screen.getByText('8/10')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset progress' }))
    expect(screen.getByRole('heading', { name: 'No sessions yet' })).toBeInTheDocument()
    expect(loadSessionSummaries()).toHaveLength(0)
  })
})
