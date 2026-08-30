import type { RefObject } from 'react'
import type {
  BondExercise,
  DiagramOrientation,
  MissingPosition,
} from '../domain/types'
import { correctAnswer } from '../domain/exerciseGenerator'

export type AnswerPhase = 'answering' | 'correct' | 'revealed'

interface NumberBondDiagramProps {
  exercise: BondExercise
  orientation: DiagramOrientation
  answer?: string
  phase?: AnswerPhase
  onAnswerChange?: (value: string) => void
  onSubmit?: () => void
  inputRef?: RefObject<HTMLInputElement | null>
  label?: string
}

const NODE_LABELS: Record<MissingPosition, string> = {
  whole: 'Whole',
  partA: 'Part one',
  partB: 'Part two',
}

function sanitizeAnswer(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 2)
  if (digits.length <= 1) return digits
  return digits.replace(/^0+/, '') || '0'
}

function valueForPosition(
  exercise: BondExercise,
  position: MissingPosition,
): number {
  if (position === 'whole') return exercise.whole
  return position === 'partA' ? exercise.parts[0] : exercise.parts[1]
}

function accessibleDescription(exercise: BondExercise): string {
  const [partA, partB] = exercise.parts
  if (exercise.missing === 'whole') {
    return `The two parts are ${partA} and ${partB}. Enter the missing whole.`
  }

  const knownPart = exercise.missing === 'partA' ? partB : partA
  return `The whole is ${exercise.whole} and one part is ${knownPart}. Enter the missing part.`
}

export function NumberBondDiagram({
  exercise,
  orientation,
  answer = '',
  phase = 'answering',
  onAnswerChange,
  onSubmit,
  inputRef,
  label,
}: NumberBondDiagramProps) {
  const interactive = Boolean(onAnswerChange)
  const positions: MissingPosition[] = ['whole', 'partA', 'partB']
  const isWholeTop = orientation === 'whole-top'

  return (
    <figure
      className={`bond-diagram bond-diagram--${orientation}`}
      aria-label={label ?? accessibleDescription(exercise)}
    >
      <svg
        className="bond-connectors"
        viewBox="0 0 360 260"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        {isWholeTop ? (
          <>
            <line x1="180" y1="80" x2="90" y2="180" />
            <line x1="180" y1="80" x2="270" y2="180" />
          </>
        ) : (
          <>
            <line x1="90" y1="80" x2="180" y2="180" />
            <line x1="270" y1="80" x2="180" y2="180" />
          </>
        )}
      </svg>

      {positions.map((position) => {
        const missing = exercise.missing === position
        const nodeValue = valueForPosition(exercise, position)
        const displayValue = missing
          ? interactive
            ? answer
            : answer || String(correctAnswer(exercise))
          : String(nodeValue)

        return (
          <div
            className={`bond-node bond-node--${position} ${
              missing ? `bond-node--missing bond-node--${phase}` : ''
            }`}
            key={position}
          >
            <span className="bond-node__label">
              {position === 'whole' ? 'Whole' : 'Part'}
            </span>
            {missing && interactive ? (
              <input
                ref={inputRef}
                className="bond-node__input"
                aria-label={`Missing ${NODE_LABELS[position].toLowerCase()}`}
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]*"
                value={answer}
                readOnly={phase !== 'answering'}
                onChange={(event) =>
                  onAnswerChange?.(sanitizeAnswer(event.target.value))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onSubmit?.()
                  }
                }}
              />
            ) : (
              <span className="bond-node__value">{displayValue}</span>
            )}
          </div>
        )
      })}
    </figure>
  )
}
