import { render, screen, waitFor } from '@testing-library/react'
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

    expect(screen.getByText('0 solved')).toBeInTheDocument()
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
})
