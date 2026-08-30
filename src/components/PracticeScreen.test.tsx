import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRESET_SETTINGS } from '../domain/types'
import {
  installSpeechSynthesisMock,
  MockSpeechSynthesisUtterance,
} from '../test/speechSynthesisMock'
import { DEFAULT_VOICE_PREFERENCES } from '../voice'
import { PracticeScreen } from './PracticeScreen'

describe('PracticeScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'speechSynthesis')
  })

  it('accepts keyboard answers and reports first-attempt success', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const user = userEvent.setup()
    const onComplete = vi.fn()

    render(
      <PracticeScreen
        settings={{ ...PRESET_SETTINGS.beginner, sessionLength: 5 }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={onComplete}
        onExit={() => undefined}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Missing whole' })
    await user.type(input, '1{Enter}')
    expect(screen.getByText('You found it!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next question' })).toHaveFocus()
  })

  it('reveals a counting hint after two misses and offers the answer after three', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const user = userEvent.setup()

    render(
      <PracticeScreen
        settings={{ ...PRESET_SETTINGS.beginner, sessionLength: 5 }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={() => undefined}
        onExit={() => undefined}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Missing whole' })
    await user.type(input, '9')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText('Almost! Take another look.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText('Count both groups together.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Check' }))
    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(input).toHaveValue('1')
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByText('Here is the answer. You can try a new one.')).toBeInTheDocument()
  })

  it('can end an endless session without recording an unanswered question', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const onExit = vi.fn()

    render(
      <PracticeScreen
        settings={{ ...PRESET_SETTINGS.standard, sessionLength: 'endless' }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={() => undefined}
        onExit={onExit}
      />,
    )

    expect(screen.getByText('0 completed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'End session' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('narrates the question, replay, and answer feedback in a teacher tone', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const speech = installSpeechSynthesisMock()
    const user = userEvent.setup()

    render(
      <PracticeScreen
        settings={{ ...PRESET_SETTINGS.beginner, sessionLength: 5 }}
        voicePreferences={DEFAULT_VOICE_PREFERENCES}
        onComplete={() => undefined}
        onExit={() => undefined}
      />,
    )

    await waitFor(() => expect(speech.synth.speak).toHaveBeenCalled())
    const question = speech.synth.speak.mock.calls[0]?.[0] as
      | MockSpeechSynthesisUtterance
      | undefined
    expect(question?.text).toBe(
      'Okay, now find the whole. What do 0 and 1 make altogether?',
    )

    await user.click(
      screen.getByRole('button', { name: 'Hear the question again' }),
    )
    expect(speech.synth.speak).toHaveBeenCalledTimes(2)

    await user.type(screen.getByRole('textbox', { name: 'Missing whole' }), '1')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    const feedback = speech.synth.speak.mock.calls.at(-1)?.[0] as
      | MockSpeechSynthesisUtterance
      | undefined
    expect(feedback?.text).toContain("That's right! 0 and 1 make 1")
    expect(speech.synth.cancel).toHaveBeenCalled()
  })

  it('narrates gentle retries, the counting hint, and a revealed answer', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const speech = installSpeechSynthesisMock()
    const user = userEvent.setup()

    render(
      <PracticeScreen
        settings={{ ...PRESET_SETTINGS.beginner, sessionLength: 5 }}
        voicePreferences={DEFAULT_VOICE_PREFERENCES}
        onComplete={() => undefined}
        onExit={() => undefined}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Missing whole' })
    await user.type(input, '9')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    let feedback = speech.synth.speak.mock.calls.at(-1)?.[0] as
      | MockSpeechSynthesisUtterance
      | undefined
    expect(feedback?.text).toBe('Good try. Take another look and try again.')

    await user.click(screen.getByRole('button', { name: 'Check' }))
    feedback = speech.synth.speak.mock.calls.at(-1)?.[0] as
      | MockSpeechSynthesisUtterance
      | undefined
    expect(feedback?.text).toContain('counting dots for a hint')

    await user.click(screen.getByRole('button', { name: 'Check' }))
    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    feedback = speech.synth.speak.mock.calls.at(-1)?.[0] as
      | MockSpeechSynthesisUtterance
      | undefined
    expect(feedback?.text).toContain('The missing whole is 1')
  })

  it('adds points and gently expands the range after three confident answers', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const user = userEvent.setup()

    render(
      <PracticeScreen
        settings={{
          ...PRESET_SETTINGS.challenge,
          exerciseMode: 'missing-whole',
          sessionLength: 5,
        }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={() => undefined}
        onExit={() => undefined}
      />,
    )

    for (let question = 0; question < 3; question += 1) {
      const sentence = screen.getByLabelText('Number sentence').textContent ?? ''
      const match = sentence.match(/\?=(\d+)\+(\d+)/)
      expect(match).not.toBeNull()
      const answer = Number(match![1]) + Number(match![2])
      await user.type(
        screen.getByRole('textbox', { name: 'Missing whole' }),
        String(answer),
      )
      await user.click(screen.getByRole('button', { name: 'Check' }))
      if (question < 2) {
        await user.click(screen.getByRole('button', { name: 'Next question' }))
      }
    }

    expect(screen.getByLabelText('33 points')).toBeInTheDocument()
    expect(screen.getByLabelText('3 answer streak')).toBeInTheDocument()
    expect(screen.getByText(/New numbers unlocked—up to 7/)).toBeInTheDocument()
    expect(screen.getByLabelText('Current number range 1 to 7')).toBeInTheDocument()
    expect(
      screen.getByText(/You earned 12 points.*Solved streak 3.*unlocked up to 7/),
    ).toHaveAttribute('role', 'status')
  })

  it('ends a timed session automatically and records the timer reason', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const onComplete = vi.fn()

    render(
      <PracticeScreen
        settings={{
          ...PRESET_SETTINGS.beginner,
          sessionLength: 'endless',
          sessionDurationMinutes: 3,
        }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={onComplete}
        onExit={() => undefined}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Missing whole' }), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByLabelText('10 points')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(180_000))

    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        questionsCompleted: 1,
        points: 10,
        durationSeconds: 180,
        endReason: 'timer',
      }),
    )
  })

  it('shows elapsed time for an unlimited session without adding urgency', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <PracticeScreen
        settings={{
          ...PRESET_SETTINGS.beginner,
          sessionLength: 'endless',
          sessionDurationMinutes: null,
        }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={() => undefined}
        onExit={() => undefined}
      />,
    )

    act(() => vi.advanceTimersByTime(65_000))
    expect(
      screen.getByRole('timer', { name: 'Elapsed time 1:05' }),
    ).toBeInTheDocument()
  })

  it('keeps a submitted unfinished question in a timed parent report', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const onComplete = vi.fn()
    const onExit = vi.fn()

    render(
      <PracticeScreen
        settings={{
          ...PRESET_SETTINGS.beginner,
          sessionLength: 'endless',
          sessionDurationMinutes: 3,
        }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={onComplete}
        onExit={onExit}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Missing whole' }), {
      target: { value: '9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    act(() => vi.advanceTimersByTime(180_000))

    expect(onExit).not.toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        questionsCompleted: 0,
        firstAttemptCorrect: 0,
        endReason: 'timer',
        breakdown: expect.objectContaining({
          byType: expect.objectContaining({
            'missing-whole': expect.objectContaining({
              attempted: 1,
              solved: 0,
              reveals: 0,
              totalAttempts: 1,
            }),
          }),
        }),
      }),
    )
  })

  it('records a reached question goal even if End session is chosen on the result', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const onComplete = vi.fn()

    render(
      <PracticeScreen
        settings={{ ...PRESET_SETTINGS.beginner, sessionLength: 5 }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={onComplete}
        onExit={() => undefined}
      />,
    )

    for (let question = 0; question < 5; question += 1) {
      const sentence = screen.getByLabelText('Number sentence').textContent ?? ''
      const match = sentence.match(/\?=(\d+)\+(\d+)/)
      const answer = Number(match?.[1]) + Number(match?.[2])
      await user.type(
        screen.getByRole('textbox', { name: 'Missing whole' }),
        String(answer),
      )
      await user.click(screen.getByRole('button', { name: 'Check' }))
      if (question < 4) {
        await user.click(screen.getByRole('button', { name: 'Next question' }))
      }
    }

    await user.click(screen.getByRole('button', { name: 'End session' }))
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        questionsCompleted: 5,
        endReason: 'questions',
      }),
    )
  })

  it('keeps a submitted unfinished question when a session is ended manually', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const onComplete = vi.fn()
    const onExit = vi.fn()

    render(
      <PracticeScreen
        settings={{
          ...PRESET_SETTINGS.beginner,
          sessionLength: 'endless',
          sessionDurationMinutes: null,
        }}
        voicePreferences={{ ...DEFAULT_VOICE_PREFERENCES, enabled: false }}
        onComplete={onComplete}
        onExit={onExit}
      />,
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Missing whole' }),
      '9',
    )
    await user.click(screen.getByRole('button', { name: 'Check' }))
    await user.click(screen.getByRole('button', { name: 'End session' }))

    expect(onExit).not.toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        questionsCompleted: 0,
        endReason: 'ended',
        breakdown: expect.objectContaining({
          byType: expect.objectContaining({
            'missing-whole': expect.objectContaining({
              attempted: 1,
              solved: 0,
            }),
          }),
        }),
      }),
    )
  })
})
