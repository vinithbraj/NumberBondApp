import { useEffect, useReducer, useRef } from 'react'
import {
  correctAnswer,
  exerciseKey,
  generateExerciseQueue,
  isCorrectAnswer,
  isZeroBond,
} from '../domain/exerciseGenerator'
import type {
  BondExercise,
  PracticeSettings,
  SessionSummary,
} from '../domain/types'
import { AppHeader } from './AppHeader'
import { DotHint } from './DotHint'
import { Keypad } from './Keypad'
import {
  NumberBondDiagram,
  type AnswerPhase,
} from './NumberBondDiagram'

interface PracticeScreenProps {
  settings: PracticeSettings
  onComplete: (summary: SessionSummary) => void
  onExit: () => void
}

interface PracticeState {
  queue: BondExercise[]
  currentIndex: number
  answer: string
  attempts: number
  phase: AnswerPhase
  completed: number
  firstAttemptCorrect: number
}

type PracticeAction =
  | { type: 'set-answer'; answer: string }
  | { type: 'wrong' }
  | { type: 'correct'; answer: string }
  | { type: 'reveal'; answer: string }
  | { type: 'next'; queue: BondExercise[] }

function practiceReducer(
  state: PracticeState,
  action: PracticeAction,
): PracticeState {
  switch (action.type) {
    case 'set-answer':
      if (state.phase !== 'answering') return state
      return { ...state, answer: action.answer }
    case 'wrong':
      return { ...state, attempts: state.attempts + 1 }
    case 'correct':
      return {
        ...state,
        answer: action.answer,
        phase: 'correct',
        completed: state.completed + 1,
        firstAttemptCorrect:
          state.firstAttemptCorrect + (state.attempts === 0 ? 1 : 0),
      }
    case 'reveal':
      return {
        ...state,
        answer: action.answer,
        phase: 'revealed',
        completed: state.completed + 1,
      }
    case 'next':
      return {
        ...state,
        queue: action.queue,
        currentIndex: state.currentIndex + 1,
        answer: '',
        attempts: 0,
        phase: 'answering',
      }
  }
}

function createInitialState(settings: PracticeSettings): PracticeState {
  const count = settings.sessionLength === 'endless' ? 20 : settings.sessionLength
  return {
    queue: generateExerciseQueue(settings, count),
    currentIndex: 0,
    answer: '',
    attempts: 0,
    phase: 'answering',
    completed: 0,
    firstAttemptCorrect: 0,
  }
}

function ensureCompatibleBatch(
  existing: BondExercise[],
  batch: BondExercise[],
): BondExercise[] {
  const previous = existing.at(-1)
  if (!previous || batch.length < 2) return batch

  const compatibleIndex = batch.findIndex(
    (exercise) =>
      exerciseKey(exercise) !== exerciseKey(previous) &&
      !(isZeroBond(previous) && isZeroBond(exercise)),
  )

  if (compatibleIndex <= 0) return batch
  return [...batch.slice(compatibleIndex), ...batch.slice(0, compatibleIndex)]
}

function promptFor(exercise: BondExercise): string {
  return exercise.missing === 'whole'
    ? 'What is the whole?'
    : 'What is the missing part?'
}

function feedbackFor(state: PracticeState): string {
  if (state.phase === 'correct') return 'You found it!'
  if (state.phase === 'revealed') return 'Here is the answer. You can try a new one.'
  if (state.attempts === 1) return 'Almost! Take another look.'
  if (state.attempts === 2) return 'Let’s count it together.'
  if (state.attempts >= 3) return 'Keep going, or let me show you.'
  return 'Type a number, then check your answer.'
}

function sentenceValues(exercise: BondExercise, answer: string) {
  return {
    whole: exercise.missing === 'whole' ? answer || '?' : String(exercise.whole),
    partA: exercise.missing === 'partA' ? answer || '?' : String(exercise.parts[0]),
    partB: exercise.missing === 'partB' ? answer || '?' : String(exercise.parts[1]),
  }
}

export function PracticeScreen({
  settings,
  onComplete,
  onExit,
}: PracticeScreenProps) {
  const [state, dispatch] = useReducer(
    practiceReducer,
    settings,
    createInitialState,
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const exercise = state.queue[state.currentIndex]

  useEffect(() => {
    if (state.phase === 'answering') inputRef.current?.focus()
    else nextButtonRef.current?.focus()
  }, [state.currentIndex, state.phase])

  if (!exercise) {
    return (
      <div className="page-shell">
        <AppHeader />
        <main className="empty-card">
          <h1>These settings need one small change.</h1>
          <p>Include zero, or choose a range with a whole of 2 or more.</p>
          <button className="button button--primary" type="button" onClick={onExit}>
            Back to settings
          </button>
        </main>
      </div>
    )
  }

  const sentence = sentenceValues(exercise, state.answer)
  const finiteLength =
    settings.sessionLength === 'endless' ? null : settings.sessionLength
  const isLast = finiteLength !== null && state.currentIndex + 1 >= finiteLength

  const makeSummary = (): SessionSummary => ({
    timestamp: new Date().toISOString(),
    settings: { ...settings },
    questionsCompleted: state.completed,
    firstAttemptCorrect: state.firstAttemptCorrect,
  })

  const submit = () => {
    if (state.phase !== 'answering' || state.answer === '') return
    const numericAnswer = Number(state.answer)
    if (isCorrectAnswer(exercise, numericAnswer)) {
      dispatch({
        type: 'correct',
        answer: String(correctAnswer(exercise)),
      })
    } else {
      dispatch({ type: 'wrong' })
      inputRef.current?.focus()
    }
  }

  const enterDigit = (digit: string) => {
    if (state.phase !== 'answering') return
    const combined = `${state.answer}${digit}`.slice(0, 2)
    const answer = combined.length > 1 ? combined.replace(/^0+/, '') || '0' : combined
    dispatch({ type: 'set-answer', answer })
    inputRef.current?.focus()
  }

  const goNext = () => {
    if (state.phase === 'answering') return
    if (isLast) {
      onComplete(makeSummary())
      return
    }

    let queue = state.queue
    if (
      settings.sessionLength === 'endless' &&
      state.currentIndex + 1 >= state.queue.length
    ) {
      const batch = ensureCompatibleBatch(
        state.queue,
        generateExerciseQueue(settings, 20),
      )
      queue = [...state.queue, ...batch]
    }
    dispatch({ type: 'next', queue })
  }

  const endSession = () => {
    if (!window.confirm('End this practice session?')) return
    if (state.completed > 0) onComplete(makeSummary())
    else onExit()
  }

  return (
    <div className="practice-page">
      <AppHeader
        compact
        action={
          <button className="text-button" type="button" onClick={endSession}>
            End session
          </button>
        }
      />
      <main className="practice-layout">
        <section className="practice-card" aria-labelledby="practice-prompt">
          <div className="practice-card__topline">
            <span className="question-progress">
              {finiteLength === null
                ? `${state.completed} solved`
                : `Question ${Math.min(state.currentIndex + 1, finiteLength)} of ${finiteLength}`}
            </span>
            {finiteLength !== null && (
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Session progress"
                aria-valuemin={0}
                aria-valuemax={finiteLength}
                aria-valuenow={state.completed}
              >
                <span style={{ width: `${(state.completed / finiteLength) * 100}%` }} />
              </div>
            )}
          </div>

          <p className="eyebrow">Number bond</p>
          <h1 id="practice-prompt">{promptFor(exercise)}</h1>

          <NumberBondDiagram
            answer={state.answer}
            exercise={exercise}
            inputRef={inputRef}
            orientation={settings.orientation}
            phase={state.phase}
            onAnswerChange={(answer) => dispatch({ type: 'set-answer', answer })}
            onSubmit={submit}
          />

          <div className="number-sentence" aria-label="Number sentence">
            <span>{sentence.whole}</span>
            <span>=</span>
            <span>{sentence.partA}</span>
            <span>+</span>
            <span>{sentence.partB}</span>
          </div>

          <p
            className={`practice-feedback practice-feedback--${state.phase}`}
            role="status"
            aria-live="polite"
          >
            {feedbackFor(state)}
          </p>

          {state.attempts >= 2 && state.phase === 'answering' && (
            <DotHint exercise={exercise} />
          )}

          {state.attempts >= 3 && state.phase === 'answering' && (
            <button
              className="text-button show-answer-button"
              type="button"
              onClick={() =>
                dispatch({
                  type: 'reveal',
                  answer: String(correctAnswer(exercise)),
                })
              }
            >
              Show answer
            </button>
          )}
        </section>

        <aside className="answer-panel" aria-label="Answer controls">
          {state.phase === 'answering' ? (
            <Keypad
              canSubmit={state.answer !== ''}
              disabled={false}
              onBackspace={() => {
                dispatch({
                  type: 'set-answer',
                  answer: state.answer.slice(0, -1),
                })
                inputRef.current?.focus()
              }}
              onDigit={enterDigit}
              onSubmit={submit}
            />
          ) : (
            <div className={`success-panel success-panel--${state.phase}`}>
              <span className="success-panel__mark" aria-hidden="true">
                {state.phase === 'correct' ? '✓' : '★'}
              </span>
              <strong>
                {state.phase === 'correct' ? 'Nice thinking!' : `It is ${correctAnswer(exercise)}.`}
              </strong>
              <button
                ref={nextButtonRef}
                className="button button--primary button--large"
                type="button"
                onClick={goNext}
              >
                {isLast ? 'See my results' : 'Next question'}
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
