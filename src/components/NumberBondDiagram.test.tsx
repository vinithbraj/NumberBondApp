import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BondExercise } from '../domain/types'
import { NumberBondDiagram } from './NumberBondDiagram'

const EXERCISE: BondExercise = {
  whole: 7,
  parts: [3, 4],
  missing: 'partB',
}

describe('NumberBondDiagram', () => {
  it('renders an accessible real input in the missing circle', () => {
    render(
      <NumberBondDiagram
        answer=""
        exercise={EXERCISE}
        orientation="whole-top"
        onAnswerChange={() => undefined}
      />,
    )

    expect(
      screen.getByLabelText(
        'The whole is 7 and one part is 3. Enter the missing part.',
      ),
    ).toHaveClass('bond-diagram--whole-top')
    expect(screen.getByRole('textbox', { name: 'Missing part two' })).toHaveAttribute(
      'inputmode',
      'numeric',
    )
  })

  it('sanitizes pasted input and submits with Enter', async () => {
    const user = userEvent.setup()
    const onAnswerChange = vi.fn()
    const onSubmit = vi.fn()
    const inputRef = createRef<HTMLInputElement>()

    render(
      <NumberBondDiagram
        answer=""
        exercise={EXERCISE}
        inputRef={inputRef}
        orientation="whole-bottom"
        onAnswerChange={onAnswerChange}
        onSubmit={onSubmit}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Missing part two' })
    fireEvent.change(input, { target: { value: 'a05x' } })
    expect(onAnswerChange).toHaveBeenCalledWith('5')
    await user.type(input, '{Enter}')
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(input.closest('figure')).toHaveClass('bond-diagram--whole-bottom')
  })

  it('locks the input after a correct answer', () => {
    render(
      <NumberBondDiagram
        answer="4"
        exercise={EXERCISE}
        orientation="whole-top"
        phase="correct"
        onAnswerChange={() => undefined}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Missing part two' })).toHaveAttribute(
      'readonly',
    )
  })
})
