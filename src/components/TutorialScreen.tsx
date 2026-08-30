import { useState } from 'react'
import type { BondExercise, DiagramOrientation } from '../domain/types'
import { AppHeader } from './AppHeader'
import { NumberBondDiagram } from './NumberBondDiagram'

interface TutorialScreenProps {
  orientation: DiagramOrientation
  replay: boolean
  onComplete: () => void
  onExit: () => void
}

const COMPLETE_BOND: BondExercise = {
  whole: 5,
  parts: [2, 3],
  missing: 'whole',
}

const MISSING_BOND: BondExercise = {
  whole: 5,
  parts: [2, 3],
  missing: 'partB',
}

const STEPS = [
  {
    eyebrow: 'Meet a number bond',
    title: 'A whole is made of two parts.',
    body: 'The lines show that the two smaller parts belong to the whole.',
  },
  {
    eyebrow: 'Put the parts together',
    title: 'Two and three make five.',
    body: 'The circle picture and the number sentence tell the same story.',
  },
  {
    eyebrow: 'Your turn',
    title: 'Find the number for the empty circle.',
    body: 'Use the whole and the part you know. A counting hint will help if you need it.',
  },
]

export function TutorialScreen({
  orientation,
  replay,
  onComplete,
  onExit,
}: TutorialScreenProps) {
  const [step, setStep] = useState(0)
  const content = STEPS[step] ?? STEPS[0]!
  const finalStep = step === STEPS.length - 1

  return (
    <div className="page-shell">
      <AppHeader
        action={
          <button className="text-button" type="button" onClick={onExit}>
            {replay ? 'Back' : 'Skip lesson'}
          </button>
        }
      />
      <main className="tutorial-card">
        <div className="step-dots" aria-label={`Step ${step + 1} of 3`}>
          {STEPS.map((_, index) => (
            <span
              className={index === step ? 'step-dot step-dot--active' : 'step-dot'}
              aria-hidden="true"
              key={index}
            />
          ))}
        </div>
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="lead-copy">{content.body}</p>

        <NumberBondDiagram
          exercise={finalStep ? MISSING_BOND : COMPLETE_BOND}
          orientation={orientation}
          answer={finalStep ? '?' : '5'}
          label={
            finalStep
              ? 'The whole is 5. One part is 2 and the other part is missing.'
              : 'The whole is 5. The parts are 2 and 3.'
          }
        />

        <div className="tutorial-equation" aria-label="Number sentence">
          {finalStep ? (
            <>
              <span>5</span>
              <span>=</span>
              <span>2</span>
              <span>+</span>
              <span className="equation-blank">?</span>
            </>
          ) : (
            <>
              <span>5</span>
              <span>=</span>
              <span>2</span>
              <span>+</span>
              <span>3</span>
            </>
          )}
        </div>

        <div className="tutorial-actions">
          {step > 0 && (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setStep((current) => current - 1)}
            >
              Back
            </button>
          )}
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              if (finalStep) onComplete()
              else setStep((current) => current + 1)
            }}
          >
            {finalStep ? 'Choose a level' : 'Next'}
          </button>
        </div>
      </main>
    </div>
  )
}
