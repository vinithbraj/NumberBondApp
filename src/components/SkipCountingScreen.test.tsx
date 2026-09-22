import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SkipCountingScreen } from './SkipCountingScreen'
import { loadCountingProgress } from '../skipCountingStorage'
import { DEFAULT_VOICE_PREFERENCES } from '../voice'
import { installSpeechSynthesisMock } from '../test/speechSynthesisMock'

const props = {
  voicePreferences: { ...DEFAULT_VOICE_PREFERENCES, enabled: false },
  onVoicePreferencesChange: vi.fn(),
  onBack: vi.fn(),
}

function correctChoice(step: number) {
  const list = screen.getByRole('list', {
    name: `Counting by ${step} sequence`,
  })
  const pads = within(list).getAllByRole('listitem')
  const missing = pads.findIndex((pad) => pad.textContent?.includes('?'))
  const previous = Number(
    pads[missing - 1]!.querySelector('.counting-pad__number')!.textContent,
  )
  return screen.getByRole('button', {
    name: `Answer ${previous + step}`,
  })
}

describe('Hop & Count', { timeout: 20_000 }, () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'speechSynthesis')
  })

  it('teaches a selected step with five hops and equal groups', async () => {
    const user = userEvent.setup()
    render(<SkipCountingScreen {...props} />)
    await user.click(
      screen.getByRole('button', { name: 'Count by 3' }),
    )
    await user.click(screen.getByRole('button', { name: 'Learn with Pip' }))
    expect(
      screen.getByRole('heading', { name: 'Let’s hop by 3!' }),
    ).toBeInTheDocument()
    for (let hop = 1; hop <= 5; hop++) {
      await user.click(screen.getByRole('button', { name: 'Hop with Pip' }))
      expect(
        screen.getByLabelText(`${hop} groups of 3 make ${hop * 3}`),
      ).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'My turn to play' }))
    expect(
      screen.getByRole('list', { name: 'Counting by 3 sequence' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('no rush')
  })

  it('finishes a round, saves results once, and starts a clean replay', async () => {
    const user = userEvent.setup()
    render(<SkipCountingScreen {...props} />)
    await user.click(screen.getByRole('button', { name: 'Let’s play' }))
    for (let hop = 0; hop < 8; hop++) {
      await user.click(correctChoice(5))
      const next = screen.getByRole('button', {
        name: hop === 7 ? /See my stars/ : /Next hop/,
      })
      expect(next).toHaveFocus()
      await user.click(next)
    }
    expect(
      screen.getByRole('heading', { name: 'You’re a hopping star!' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('3 of 3 stars collected')).toBeInTheDocument()
    expect(loadCountingProgress().sessions).toHaveLength(1)
    expect(loadCountingProgress().sessions[0]).toMatchObject({
      points: 90,
      firstTry: 8,
      attempted: 8,
      solved: 8,
      reveals: 0,
    })
    await user.click(screen.getByRole('button', { name: /Play again/ }))
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.getByRole('timer')).toHaveTextContent('no rush')
    expect(loadCountingProgress().sessions).toHaveLength(1)
  })

  it('narrates automatic hops, pauses the lesson, and cleans up when leaving', () => {
    vi.useFakeTimers()
    const { synth } = installSpeechSynthesisMock()
    render(
      <SkipCountingScreen
        {...props}
        voicePreferences={DEFAULT_VOICE_PREFERENCES}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Learn with Pip' }))
    expect(synth.speak).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Each hop adds 5'),
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Count for me/ }))
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.getByLabelText('1 groups of 5 make 5')).toBeInTheDocument()
    expect(synth.speak).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: '5! 0 plus 5 makes 5.' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Pause counting' }))
    act(() => vi.advanceTimersByTime(12000))
    expect(screen.getByLabelText('1 groups of 5 make 5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Count for me/ }))
    fireEvent.click(screen.getByRole('button', { name: /Choose your hop/ }))
    act(() => vi.advanceTimersByTime(8000))
    expect(
      screen.getByRole('button', { name: 'Learn with Pip' }),
    ).toBeInTheDocument()
    expect(synth.cancel).toHaveBeenCalled()
  })

  it('offers a supportive route through mistakes, hints and revealed answers', async () => {
    const user = userEvent.setup()
    render(<SkipCountingScreen {...props} />)
    await user.click(screen.getByRole('button', { name: 'Let’s play' }))
    const correct = correctChoice(5)
    const wrong = screen
      .getAllByRole('button', { name: /^Answer / })
      .find((button) => button !== correct)!
    await user.click(wrong)
    expect(wrong).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Let’s try again')
    await user.click(screen.getByRole('button', { name: /Help me count/ }))
    expect(screen.getByText('10 + 5 = 15')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Show me & keep learning' }),
    )
    await user.click(screen.getByRole('button', { name: 'Finish for now' }))
    expect(loadCountingProgress().sessions[0]).toMatchObject({
      points: 1,
      firstTry: 0,
      solved: 0,
      reveals: 1,
      hints: 1,
    })
  })

  it('pauses timed rounds, resumes them, and finishes automatically at the deadline', () => {
    vi.useFakeTimers()
    render(<SkipCountingScreen {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /2 minutes/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }))
    fireEvent.click(correctChoice(5))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('timer')).toHaveTextContent('1:50')
    fireEvent.click(screen.getByRole('button', { name: 'Pause game' }))
    act(() => vi.advanceTimersByTime(120000))
    expect(screen.getByRole('timer')).toHaveTextContent('1:50')
    fireEvent.click(screen.getByRole('button', { name: /Keep hopping/ }))
    act(() => vi.advanceTimersByTime(110000))
    expect(
      screen.getByRole('heading', { name: 'Lovely hopping!' }),
    ).toBeInTheDocument()
    expect(loadCountingProgress().sessions[0]).toMatchObject({
      endReason: 'timer',
      durationSeconds: 120,
      completed: 1,
      points: 10,
    })
  })

  it('automatically pauses a hidden tab and requires an explicit resume', () => {
    vi.useFakeTimers()
    render(<SkipCountingScreen {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }))
    act(() => vi.advanceTimersByTime(5000))
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    act(() => vi.advanceTimersByTime(60000))
    expect(
      screen.getByRole('heading', { name: 'A little pond break.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:05')
  })
})
