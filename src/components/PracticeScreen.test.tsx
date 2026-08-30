import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRESET_SETTINGS } from '../domain/types'
import { PracticeScreen } from './PracticeScreen'

describe('PracticeScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts keyboard answers and reports first-attempt success', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const user = userEvent.setup()
    const onComplete = vi.fn()

    render(
      <PracticeScreen
        settings={{ ...PRESET_SETTINGS.beginner, sessionLength: 5 }}
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
        onComplete={() => undefined}
        onExit={onExit}
      />,
    )

    expect(screen.getByText('0 solved')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'End session' }))
    expect(onExit).toHaveBeenCalledOnce()
  })
})
