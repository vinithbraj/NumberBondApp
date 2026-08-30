import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  createAdaptiveState,
  recordAdaptiveOutcome,
  selectNextAdaptiveExercise,
  type AdaptiveState,
} from '../domain/adaptive'
import { correctAnswer, isCorrectAnswer } from '../domain/exerciseGenerator'
import {
  emptySessionBreakdown,
  recordQuestionResult,
} from '../domain/performance'
import { scoreQuestion, type QuestionScore } from '../domain/scoring'
import type {
  BondExercise,
  PracticeSettings,
  SessionBreakdown,
  SessionEndReason,
  SessionSummary,
} from '../domain/types'
import { useSpeechFeedback } from '../hooks/useSpeechFeedback'
import type { VoicePreferences } from '../voice'
import {
  correctFeedbackFor,
  incorrectFeedbackFor,
  questionPromptFor,
  revealedAnswerFeedbackFor,
} from '../voice'
import { AppHeader } from './AppHeader'
import { DotHint } from './DotHint'
import { Keypad } from './Keypad'
import {
  NumberBondDiagram,
  type AnswerPhase,
} from './NumberBondDiagram'

interface PracticeScreenProps {
  settings: PracticeSettings
  voicePreferences: VoicePreferences
  onComplete: (summary: SessionSummary) => void
  onExit: () => void
}

interface PracticeState {
  exercise: BondExercise | undefined
  adaptiveState: AdaptiveState
  questionNumber: number
  questionStartedAt: number
  answer: string
  attempts: number
  phase: AnswerPhase
  completed: number
  firstAttemptCorrect: number
  points: number
  currentStreak: number
  maxStreak: number
  highestWhole: number
  highestAdaptiveMax: number
  adaptiveLevelUps: number
  breakdown: SessionBreakdown
  award: QuestionScore | null
  levelUpMax: number | null
}

type PracticeAction =
  | { type: 'set-answer'; answer: string }
  | { type: 'wrong' }
  | {
      type: 'resolve'
      answer: string
      phase: Extract<AnswerPhase, 'correct' | 'revealed'>
      award: QuestionScore
      adaptiveState: AdaptiveState
      breakdown: SessionBreakdown
      levelUpMax: number | null
    }
  | {
      type: 'next'
      exercise: BondExercise | undefined
      adaptiveState: AdaptiveState
      startedAt: number
    }

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
    case 'resolve':
      return {
        ...state,
        answer: action.answer,
        phase: action.phase,
        completed: state.completed + 1,
        firstAttemptCorrect:
          state.firstAttemptCorrect +
          (action.phase === 'correct' && state.attempts === 0 ? 1 : 0),
        points: state.points + action.award.points,
        currentStreak: action.award.newStreak,
        maxStreak: Math.max(state.maxStreak, action.award.newStreak),
        highestWhole: Math.max(
          state.highestWhole,
          state.exercise?.whole ?? 0,
        ),
        highestAdaptiveMax: Math.max(
          state.highestAdaptiveMax,
          action.adaptiveState.currentMax,
        ),
        adaptiveLevelUps:
          state.adaptiveLevelUps + (action.levelUpMax === null ? 0 : 1),
        adaptiveState: action.adaptiveState,
        breakdown: action.breakdown,
        award: action.award,
        levelUpMax: action.levelUpMax,
      }
    case 'next':
      return {
        ...state,
        exercise: action.exercise,
        adaptiveState: action.adaptiveState,
        questionNumber: state.questionNumber + 1,
        questionStartedAt: action.startedAt,
        answer: '',
        attempts: 0,
        phase: 'answering',
        award: null,
        levelUpMax: null,
      }
  }
}

function createInitialState(settings: PracticeSettings): PracticeState {
  const adaptiveState = createAdaptiveState(settings)
  const selection = selectNextAdaptiveExercise(settings, adaptiveState)

  return {
    exercise: selection.exercise,
    adaptiveState: selection.state,
    questionNumber: 0,
    questionStartedAt: Date.now(),
    answer: '',
    attempts: 0,
    phase: 'answering',
    completed: 0,
    firstAttemptCorrect: 0,
    points: 0,
    currentStreak: 0,
    maxStreak: 0,
    highestWhole: 0,
    highestAdaptiveMax: selection.state.currentMax,
    adaptiveLevelUps: 0,
    breakdown: emptySessionBreakdown(),
    award: null,
    levelUpMax: null,
  }
}

function promptFor(exercise: BondExercise): string {
  if (exercise.missing === 'whole') {
    return `What do ${exercise.parts[0]} and ${exercise.parts[1]} make?`
  }
  const knownPart =
    exercise.missing === 'partA' ? exercise.parts[1] : exercise.parts[0]
  return `The whole is ${exercise.whole}. One part is ${knownPart}. What part is missing?`
}

function promptKind(exercise: BondExercise): string {
  return exercise.missing === 'whole'
    ? 'Find the whole'
    : 'Find the missing part'
}

function feedbackFor(state: PracticeState): string {
  if (state.phase === 'correct') return 'You found it!'
  if (state.phase === 'revealed') {
    return 'Here is the answer. You can try a new one.'
  }
  if (state.attempts === 1) return 'Almost! Take another look.'
  if (state.attempts === 2) return 'Let’s count it together.'
  if (state.attempts >= 3) return 'Keep going, or let me show you.'
  return 'Type a number, then check your answer.'
}

function sentenceValues(exercise: BondExercise, answer: string) {
  return {
    whole:
      exercise.missing === 'whole' ? answer || '?' : String(exercise.whole),
    partA:
      exercise.missing === 'partA' ? answer || '?' : String(exercise.parts[0]),
    partB:
      exercise.missing === 'partB' ? answer || '?' : String(exercise.parts[1]),
  }
}

function elapsedSecondsSince(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
}

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function summaryFromState(
  state: PracticeState,
  settings: PracticeSettings,
  endReason: SessionEndReason,
  durationSeconds: number,
): SessionSummary {
  return {
    timestamp: new Date().toISOString(),
    settings: { ...settings },
    questionsCompleted: state.completed,
    firstAttemptCorrect: state.firstAttemptCorrect,
    points: state.points,
    maxStreak: state.maxStreak,
    durationSeconds: Math.max(0, Math.floor(durationSeconds)),
    highestWhole: state.highestWhole,
    adaptiveLevelUps: state.adaptiveLevelUps,
    endReason,
    breakdown: state.breakdown,
  }
}

function attemptedQuestionCount(state: PracticeState): number {
  return (
    state.breakdown.byType['missing-whole'].attempted +
    state.breakdown.byType['missing-part'].attempted
  )
}

function withUnfinishedAttempt(state: PracticeState): PracticeState {
  if (
    state.phase !== 'answering' ||
    state.attempts === 0 ||
    !state.exercise
  ) {
    return state
  }

  return {
    ...state,
    highestWhole: Math.max(state.highestWhole, state.exercise.whole),
    breakdown: recordQuestionResult(state.breakdown, {
      whole: state.exercise.whole,
      missingPosition: state.exercise.missing,
      attempts: state.attempts,
      firstTry: false,
      hintUsed: state.attempts >= 2,
      revealed: false,
      solved: false,
      responseMs: Date.now() - state.questionStartedAt,
    }),
  }
}

export function PracticeScreen({
  settings,
  voicePreferences,
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
  const sessionStartedAtRef = useRef(state.questionStartedAt)
  const stateRef = useRef(state)
  const sessionFinishedRef = useRef(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const exercise = state.exercise
  const { isSupported: voiceSupported, speak, stop } =
    useSpeechFeedback(voicePreferences)
  const timedLimitSeconds =
    settings.sessionLength === 'endless' &&
    settings.sessionDurationMinutes !== null
      ? settings.sessionDurationMinutes * 60
      : null

  const dispatchPractice = (action: PracticeAction) => {
    stateRef.current = practiceReducer(stateRef.current, action)
    dispatch(action)
  }

  const finishLatestSession = useCallback(
    (endReason: SessionEndReason) => {
      if (sessionFinishedRef.current) return
      sessionFinishedRef.current = true
      stop()
      const latest = withUnfinishedAttempt(stateRef.current)
      stateRef.current = latest
      if (attemptedQuestionCount(latest) === 0) {
        onExit()
        return
      }

      const duration =
        timedLimitSeconds !== null && endReason === 'timer'
          ? timedLimitSeconds
          : elapsedSecondsSince(sessionStartedAtRef.current)
      onComplete(summaryFromState(latest, settings, endReason, duration))
    },
    [onComplete, onExit, settings, stop, timedLimitSeconds],
  )

  useEffect(() => {
    if (state.phase === 'answering') inputRef.current?.focus()
    else nextButtonRef.current?.focus()
  }, [state.questionNumber, state.phase])

  useEffect(() => {
    if (!exercise) return undefined
    speak(questionPromptFor(exercise, state.questionNumber))
    return stop
  }, [exercise, speak, state.questionNumber, stop])

  useEffect(() => {
    const updateClock = () => {
      const elapsed = elapsedSecondsSince(sessionStartedAtRef.current)
      setElapsedSeconds(
        timedLimitSeconds === null
          ? elapsed
          : Math.min(timedLimitSeconds, elapsed),
      )

      if (
        timedLimitSeconds !== null &&
        elapsed >= timedLimitSeconds &&
        !sessionFinishedRef.current
      ) {
        finishLatestSession('timer')
      }
    }

    updateClock()
    const interval = window.setInterval(updateClock, 250)
    return () => window.clearInterval(interval)
  }, [finishLatestSession, timedLimitSeconds])

  if (!exercise) {
    return (
      <div className="page-shell">
        <AppHeader />
        <main className="empty-card">
          <h1>These settings need one small change.</h1>
          <p>Include zero, or choose a range with a whole of 2 or more.</p>
          <button
            className="button button--primary"
            type="button"
            onClick={onExit}
          >
            Back to settings
          </button>
        </main>
      </div>
    )
  }

  const sentence = sentenceValues(exercise, state.answer)
  const finiteLength =
    settings.sessionLength === 'endless' ? null : settings.sessionLength
  const isLast = finiteLength !== null && state.completed >= finiteLength
  const displayedTime =
    timedLimitSeconds === null
      ? elapsedSeconds
      : Math.max(0, timedLimitSeconds - elapsedSeconds)

  const stopAtTimedBoundary = (): boolean => {
    if (
      timedLimitSeconds === null ||
      elapsedSecondsSince(sessionStartedAtRef.current) < timedLimitSeconds
    ) {
      return false
    }
    finishLatestSession('timer')
    return true
  }

  const resolveQuestion = (revealed: boolean) => {
    if (state.phase !== 'answering' || stopAtTimedBoundary()) return
    const attemptNumber = state.attempts + 1
    const award = scoreQuestion(
      { attemptNumber, revealed },
      state.currentStreak,
    )
    const nextAdaptiveState = recordAdaptiveOutcome(
      state.adaptiveState,
      settings,
      { attemptNumber, revealed },
    )
    const levelUpMax =
      nextAdaptiveState.currentMax > state.highestAdaptiveMax
        ? nextAdaptiveState.currentMax
        : null
    const breakdown = recordQuestionResult(state.breakdown, {
      whole: exercise.whole,
      missingPosition: exercise.missing,
      attempts: revealed ? state.attempts : attemptNumber,
      firstTry: !revealed && attemptNumber === 1,
      hintUsed: state.attempts >= 2,
      revealed,
      responseMs: Date.now() - state.questionStartedAt,
    })

    dispatchPractice({
      type: 'resolve',
      answer: String(correctAnswer(exercise)),
      phase: revealed ? 'revealed' : 'correct',
      award,
      adaptiveState: nextAdaptiveState,
      breakdown,
      levelUpMax,
    })
  }

  const submit = () => {
    if (
      state.phase !== 'answering' ||
      state.answer === '' ||
      stopAtTimedBoundary()
    ) {
      return
    }
    const numericAnswer = Number(state.answer)
    if (isCorrectAnswer(exercise, numericAnswer)) {
      speak(correctFeedbackFor(exercise))
      resolveQuestion(false)
    } else {
      speak(incorrectFeedbackFor(state.attempts + 1))
      dispatchPractice({ type: 'wrong' })
      inputRef.current?.focus()
    }
  }

  const enterDigit = (digit: string) => {
    if (state.phase !== 'answering' || stopAtTimedBoundary()) return
    const combined = `${state.answer}${digit}`.slice(0, 2)
    const answer =
      combined.length > 1 ? combined.replace(/^0+/, '') || '0' : combined
    dispatchPractice({ type: 'set-answer', answer })
    inputRef.current?.focus()
  }

  const goNext = () => {
    if (state.phase === 'answering' || stopAtTimedBoundary()) return
    if (isLast) {
      finishLatestSession('questions')
      return
    }

    stop()
    const selection = selectNextAdaptiveExercise(
      settings,
      state.adaptiveState,
      exercise,
    )
    dispatchPractice({
      type: 'next',
      exercise: selection.exercise,
      adaptiveState: selection.state,
      startedAt: Date.now(),
    })
  }

  const endSession = () => {
    if (!window.confirm('End this practice session?')) return
    if (stopAtTimedBoundary()) return
    const latest = stateRef.current
    const reachedQuestionGoal =
      finiteLength !== null && latest.completed >= finiteLength
    if (latest.completed > 0 || latest.attempts > 0) {
      finishLatestSession(reachedQuestionGoal ? 'questions' : 'ended')
    } else {
      sessionFinishedRef.current = true
      stop()
      onExit()
    }
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
      <div className="game-hud" aria-label="Practice status">
        <div className="game-hud__score" aria-label={`${state.points} points`}>
          <span aria-hidden="true">★</span>
          <strong>{state.points}</strong>
          <small>points</small>
        </div>
        <div
          className={`game-hud__streak ${
            state.currentStreak >= 2 ? 'game-hud__streak--active' : ''
          }`}
          aria-label={`${state.currentStreak} answer streak`}
        >
          <span aria-hidden="true">✦</span>
          <strong>{state.currentStreak}</strong>
          <small>streak</small>
        </div>
        <div
          className="game-hud__range"
          aria-label={`Current number range ${settings.minWhole} to ${state.adaptiveState.currentMax}`}
        >
          <strong>
            {settings.minWhole}–{state.adaptiveState.currentMax}
          </strong>
          <small>{settings.adaptive ? 'growing range' : 'number range'}</small>
        </div>
        <div
          className={`game-hud__timer ${
            timedLimitSeconds !== null && displayedTime <= 30
              ? 'game-hud__timer--ending'
              : ''
          }`}
          role="timer"
          aria-label={`${
            timedLimitSeconds === null ? 'Elapsed time' : 'Time remaining'
          } ${formatClock(displayedTime)}`}
        >
          <strong>{formatClock(displayedTime)}</strong>
          <small>{timedLimitSeconds === null ? 'time' : 'left'}</small>
        </div>
      </div>
      <main className="practice-layout">
        <section className="practice-card" aria-labelledby="practice-prompt">
          <div className="practice-card__topline">
            <span className="question-progress">
              {finiteLength === null
                ? `${state.completed} completed`
                : `Question ${Math.min(state.questionNumber + 1, finiteLength)} of ${finiteLength}`}
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
                <span
                  style={{
                    width: `${(state.completed / finiteLength) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>

          <p className="eyebrow">{promptKind(exercise)}</p>
          <h1 id="practice-prompt">{promptFor(exercise)}</h1>
          {voicePreferences.enabled && voiceSupported && (
            <button
              className="listen-button"
              type="button"
              onClick={() =>
                speak(questionPromptFor(exercise, state.questionNumber))
              }
            >
              <span aria-hidden="true">▶</span>
              Hear the question again
            </button>
          )}

          <NumberBondDiagram
            answer={state.answer}
            exercise={exercise}
            inputRef={inputRef}
            orientation={settings.orientation}
            phase={state.phase}
            onAnswerChange={(answer) =>
              dispatchPractice({ type: 'set-answer', answer })
            }
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
          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {state.phase !== 'answering' && state.award
              ? `You earned ${state.award.points} ${
                  state.award.points === 1 ? 'point' : 'points'
                }. ${
                  state.award.newStreak > 0
                    ? `Solved streak ${state.award.newStreak}.`
                    : 'The solved streak can begin again on the next question.'
                } ${
                  state.levelUpMax === null
                    ? ''
                    : `New numbers unlocked up to ${state.levelUpMax}.`
                }`
              : ''}
          </p>

          {state.attempts >= 2 && state.phase === 'answering' && (
            <DotHint exercise={exercise} />
          )}

          {state.attempts >= 3 && state.phase === 'answering' && (
            <button
              className="text-button show-answer-button"
              type="button"
              onClick={() => {
                speak(revealedAnswerFeedbackFor(exercise))
                resolveQuestion(true)
              }}
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
                dispatchPractice({
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
                {state.phase === 'correct'
                  ? state.award?.label ?? 'Nice thinking!'
                  : `It is ${correctAnswer(exercise)}.`}
              </strong>
              {state.award && (
                <p className="point-award">
                  +{state.award.points}{' '}
                  {state.award.points === 1 ? 'point' : 'points'}
                </p>
              )}
              {state.levelUpMax !== null && (
                <p className="level-up-toast">
                  <span aria-hidden="true">↑</span> New numbers unlocked—up to{' '}
                  {state.levelUpMax}!
                </p>
              )}
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
