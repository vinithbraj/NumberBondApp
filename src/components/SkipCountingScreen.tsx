import { useEffect, useReducer, useRef, useState } from 'react'
import {
  COUNTING_STEPS,
  ROUND_LENGTH,
  countingReducer,
  countingStars,
  createCountingRound,
  summarizeCountingRound,
  type CountingSettings,
  type CountingSummary,
} from '../domain/skipCounting'
import { useSpeechFeedback } from '../hooks/useSpeechFeedback'
import {
  loadCountingProgress,
  saveCountingProgress,
} from '../skipCountingStorage'
import type { VoicePreferences } from '../voice'
import { ActivityNav } from './ActivityNav'
import { AppHeader } from './AppHeader'
import {
  CountingGroups,
  CountingPond,
  CountingStars,
  Frog,
} from './CountingGarden'
import './skip-counting.css'

interface SkipCountingProps {
  voicePreferences: VoicePreferences
  onVoicePreferencesChange: (preferences: VoicePreferences) => void
  onBack: () => void
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function ListenButton({
  onClick,
  enabled,
}: {
  onClick: () => void
  enabled: boolean
}) {
  return enabled ? (
    <button
      className="counting-listen"
      type="button"
      onClick={onClick}
      aria-label="Hear it again"
    >
      ♪ <span>Listen</span>
    </button>
  ) : null
}

function CountingLesson({
  settings,
  voicePreferences,
  onPlay,
  onBack,
}: {
  settings: CountingSettings
  voicePreferences: VoicePreferences
  onPlay: () => void
  onBack: () => void
}) {
  const [hop, setHop] = useState(0)
  const [playing, setPlaying] = useState(false)
  const { speak, stop, isSupported } = useSpeechFeedback(voicePreferences)
  const step = settings.step
  const total = hop * step
  const prompt =
    hop === 0
      ? `Hi, I'm Pip! Let's count by ${step}. Start at zero. Each hop adds ${step}. Tap Hop with Pip!`
      : hop === 5
        ? `${total}! You counted by ${step}! Now you're ready to play.`
        : `${total}! ${total - step} plus ${step} makes ${total}.`

  useEffect(() => {
    speak(prompt)
  }, [prompt, speak])
  useEffect(() => {
    if (!playing || hop === 5) return
    const timeout = window.setTimeout(
      () => setHop((current) => current + 1),
      4000,
    )
    return () => window.clearTimeout(timeout)
  }, [playing, hop])
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () =>
      document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  return (
    <main className="counting-main">
      <div className="counting-topline">
        <button type="button" className="text-button" onClick={onBack}>
          ← Choose your hop
        </button>
        <span className="counting-pill">LEARN TOGETHER</span>
      </div>
      <section className="counting-play-card">
        <div className="counting-card-heading">
          <div>
            <p className="eyebrow">Meet Pip, your counting buddy</p>
            <h1>Let’s hop by {step}!</h1>
          </div>
          <ListenButton
            enabled={voicePreferences.enabled && isSupported}
            onClick={() => speak(prompt)}
          />
        </div>
        <p className="counting-instruction">
          Start at 0. Add <strong>{step}</strong> with every hop.
        </p>
        <CountingPond
          numbers={Array.from({ length: 6 }, (_, index) => index * step)}
          active={hop}
          step={step}
        />
        <div className="counting-lesson-bottom">
          <div>
            <p className="counting-equation" aria-live="polite">
              {hop === 0 ? (
                <>
                  Ready, set… <strong>0!</strong>
                </>
              ) : (
                <>
                  {total - step} + {step} = <strong>{total}</strong>
                </>
              )}
            </p>
            <CountingGroups step={step} groups={hop} />
            <p className="counting-small">
              {hop === 0
                ? `Each little box holds ${step} dots.`
                : `${hop} ${hop === 1 ? 'group' : 'groups'} of ${step} makes ${total}.`}
            </p>
          </div>
          <div className="counting-lesson-actions">
            {hop < 5 ? (
              <>
                <button
                  className="counting-primary"
                  type="button"
                  onClick={() => {
                    setPlaying(false)
                    setHop((current) => current + 1)
                  }}
                >
                  Hop with Pip <span aria-hidden="true">↗</span>
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    if (playing) stop()
                    else speak(`Let’s count by ${step}. ${total}.`)
                    setPlaying(!playing)
                  }}
                >
                  {playing ? 'Pause counting' : '▶ Count for me'}
                </button>
              </>
            ) : (
              <>
                <button
                  className="counting-primary"
                  type="button"
                  onClick={onPlay}
                >
                  My turn to play <span aria-hidden="true">→</span>
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setHop(0)
                    setPlaying(false)
                  }}
                >
                  ↻ Learn again
                </button>
              </>
            )}
          </div>
        </div>
      </section>
      {hop < 5 && (
        <button
          type="button"
          className="text-button counting-skip-lesson"
          onClick={onPlay}
        >
          I’m ready to play →
        </button>
      )}
    </main>
  )
}

function CountingGame({
  settings,
  voicePreferences,
  onSave,
  onBack,
  onAgain,
  onLearn,
}: {
  settings: CountingSettings
  voicePreferences: VoicePreferences
  onSave: (summary: CountingSummary) => void
  onBack: () => void
  onAgain: () => void
  onLearn: () => void
}) {
  const [state, dispatch] = useReducer(countingReducer, settings, (initial) =>
    createCountingRound(initial, performance.now()),
  )
  const { speak, stop, isSupported } = useSpeechFeedback(voicePreferences)
  const saved = useRef(false)
  const nextButton = useRef<HTMLButtonElement>(null)
  const questionHeading = useRef<HTMLHeadingElement>(null)
  const summaryHeading = useRef<HTMLHeadingElement>(null)
  const question = state.questions[state.index]!
  const resolved = state.phase !== 'answering'
  const remaining = Math.max(
    0,
    settings.timer - Math.floor(state.elapsedMs / 1000),
  )
  const prompt = `Count by ${settings.step}. ${question.numbers.map((number, index) => (index === question.missing ? 'what number' : number)).join(', ')}?`
  const previous = question.numbers[question.missing - 1]!
  const feedback =
    state.phase === 'revealed'
      ? `Let’s learn it: ${previous} + ${settings.step} = ${question.answer}.`
      : state.phase === 'correct'
        ? `${question.answer}! ${state.award === 15 ? 'Three in a row! +5 bonus points.' : 'You found the hop!'}`
        : state.wrongChoices.length > 0
          ? `Let’s try again. Add ${settings.step} to ${previous}.`
          : 'Tap the number that belongs on the lily pad.'

  useEffect(() => {
    if (state.paused || state.endReason) return
    const interval = window.setInterval(
      () => dispatch({ type: 'tick', now: performance.now() }),
      250,
    )
    return () => window.clearInterval(interval)
  }, [state.paused, state.endReason])

  useEffect(() => {
    const pause = () => {
      if (document.hidden) dispatch({ type: 'pause', now: performance.now() })
    }
    document.addEventListener('visibilitychange', pause)
    return () => document.removeEventListener('visibilitychange', pause)
  }, [])

  useEffect(() => {
    if (state.paused) {
      stop()
      return
    }
    if (!state.endReason) speak(prompt)
  }, [prompt, speak, stop, state.paused, state.endReason])

  useEffect(() => {
    if (resolved) nextButton.current?.focus()
    else questionHeading.current?.focus()
  }, [resolved, state.index, state.paused])

  useEffect(() => {
    if (!state.endReason || saved.current) return
    saved.current = true
    const summary = summarizeCountingRound(state)
    if (summary.attempted > 0) onSave(summary)
    speak(
      `Lovely hopping! You earned ${state.points} points. Every hop helps your brain grow!`,
    )
    summaryHeading.current?.focus()
  }, [state, onSave, speak])

  const stars = countingStars(state.completed)
  if (state.endReason) {
    return (
      <main className="counting-main">
        <section className="counting-result">
          <div className="counting-confetti" aria-hidden="true">
            {Array.from({ length: 14 }, (_, index) => (
              <i
                key={index}
                style={{
                  left: `${6 + index * 6.7}%`,
                  animationDelay: `${index * 0.09}s`,
                  background: ['#e4b953', '#84b89b', '#b9a2c7'][index % 3],
                }}
              />
            ))}
          </div>
          <Frog />
          <p className="eyebrow">
            {state.endReason === 'timer'
              ? 'Time for a little celebration'
              : state.endReason === 'complete'
                ? 'Adventure complete'
                : 'Every little hop counts'}
          </p>
          <h1 ref={summaryHeading} tabIndex={-1}>
            {state.completed === ROUND_LENGTH
              ? 'You’re a hopping star!'
              : 'Lovely hopping!'}
          </h1>
          <p className="lead-copy">
            You practiced counting by <strong>{settings.step}</strong>. Look
            what you collected!
          </p>
          <CountingStars earned={stars} />
          <div className="counting-result-stats">
            <div>
              <strong>{state.points}</strong>
              <span>points earned</span>
            </div>
            <div>
              <strong>{state.completed}</strong>
              <span>hops practiced</span>
            </div>
            <div>
              <strong>{clock(Math.floor(state.elapsedMs / 1000))}</strong>
              <span>time exploring</span>
            </div>
          </div>
          <p className="counting-small">
            {state.firstTry} first try · {state.solved} solved · {state.reveals}{' '}
            learned together
          </p>
          <div className="counting-result-actions">
            <button
              className="counting-primary"
              type="button"
              onClick={onAgain}
            >
              Play again ↗
            </button>
            <button
              className="counting-secondary"
              type="button"
              onClick={onBack}
            >
              Choose another number
            </button>
          </div>
          <button type="button" className="text-button" onClick={onLearn}>
            Learn with Pip again
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="counting-main">
      <div className="counting-topline">
        <span className="counting-pill">COUNTING BY {settings.step}</span>
        <button
          className="text-button"
          type="button"
          onClick={() => dispatch({ type: 'finish', now: performance.now() })}
        >
          Finish for now
        </button>
      </div>
      <div className="counting-hud">
        <div className="counting-hud__points">
          <span aria-hidden="true">★</span>
          <strong>{state.points}</strong>
          <span>points</span>
        </div>
        <div className="counting-hud__progress">
          <span>
            HOP {Math.min(state.index + 1, ROUND_LENGTH)} OF {ROUND_LENGTH}
          </span>
          <div
            className="counting-progress-track"
            role="progressbar"
            aria-label="Hops practiced"
            aria-valuenow={state.completed}
            aria-valuemin={0}
            aria-valuemax={ROUND_LENGTH}
          >
            <i
              style={{ width: `${(state.completed / ROUND_LENGTH) * 100}%` }}
            />
          </div>
        </div>
        <div
          className="counting-hud__clock"
          role="timer"
          aria-label={settings.timer ? 'Time remaining' : 'Time exploring'}
        >
          <span aria-hidden="true">◷</span>
          <strong>
            {clock(
              settings.timer ? remaining : Math.floor(state.elapsedMs / 1000),
            )}
          </strong>
          <small>{settings.timer ? 'left to explore' : 'no rush'}</small>
        </div>
        <button
          type="button"
          className="counting-pause"
          aria-label={state.paused ? 'Resume game' : 'Pause game'}
          onClick={() =>
            dispatch({
              type: state.paused ? 'resume' : 'pause',
              now: performance.now(),
            })
          }
        >
          {state.paused ? '▶' : 'Ⅱ'}
        </button>
      </div>
      {state.paused ? (
        <section className="counting-paused">
          <Frog />
          <h1>A little pond break.</h1>
          <p>Your points are safe. Pip will wait for you.</p>
          <button
            className="counting-primary"
            type="button"
            onClick={() => dispatch({ type: 'resume', now: performance.now() })}
          >
            Keep hopping →
          </button>
        </section>
      ) : (
        <section className="counting-play-card">
          <div className="counting-card-heading">
            <div>
              <p className="eyebrow">
                {question.missing === 3
                  ? 'Follow the pattern'
                  : 'A little number is hiding'}
              </p>
              <h1 ref={questionHeading} tabIndex={-1}>
                {question.missing === 3
                  ? 'Where will Pip hop next?'
                  : 'Find the missing number!'}
              </h1>
            </div>
            <ListenButton
              enabled={voicePreferences.enabled && isSupported}
              onClick={() => speak(prompt)}
            />
          </div>
          <CountingPond
            numbers={question.numbers}
            active={resolved ? question.missing : question.missing - 1}
            missing={question.missing}
            resolved={resolved}
            step={settings.step}
          />
          <div className="counting-answer-area">
            <p
              className={`counting-feedback ${resolved ? 'counting-feedback--success' : ''}`}
              role="status"
            >
              {feedback} {resolved && <strong>+{state.award} points</strong>}
            </p>
            {state.hint && !resolved && (
              <div className="counting-hint">
                <span>
                  Start at <strong>{previous}</strong>. Count {settings.step}{' '}
                  more:
                </span>
                <span className="counting-hint__dots">
                  {Array.from({ length: settings.step }, (_, index) => (
                    <span key={index}>{previous + index + 1}</span>
                  ))}
                </span>
                <strong>
                  {previous} + {settings.step} = {question.answer}
                </strong>
              </div>
            )}
            {!resolved ? (
              <>
                <div className="counting-answers" aria-label="Answer choices">
                  {question.choices.map((choice) => (
                    <button
                      type="button"
                      className="counting-answer"
                      key={choice}
                      disabled={state.wrongChoices.includes(choice)}
                      aria-label={`Answer ${choice}`}
                      onClick={() => {
                        dispatch({
                          type: 'answer',
                          value: choice,
                          now: performance.now(),
                        })
                        speak(
                          choice === question.answer
                            ? `${choice}! You found it!`
                            : `Good trying! Add ${settings.step} to ${previous}.`,
                        )
                      }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
                <div className="counting-help-actions">
                  <button
                    className="text-button"
                    type="button"
                    disabled={state.hint}
                    onClick={() => {
                      dispatch({ type: 'hint', now: performance.now() })
                      speak(
                        `Start at ${previous}. Count ${settings.step} more. ${Array.from({ length: settings.step }, (_, i) => previous + i + 1).join(', ')}.`,
                      )
                    }}
                  >
                    ✦ Help me count
                  </button>
                  {(state.hint || state.wrongChoices.length >= 2) && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'reveal', now: performance.now() })
                        speak(
                          `${previous} plus ${settings.step} makes ${question.answer}. Let's keep learning!`,
                        )
                      }}
                    >
                      Show me & keep learning
                    </button>
                  )}
                </div>
              </>
            ) : (
              <button
                className="counting-primary counting-next"
                ref={nextButton}
                type="button"
                onClick={() =>
                  dispatch({ type: 'next', now: performance.now() })
                }
              >
                {state.completed === ROUND_LENGTH
                  ? 'See my stars ★'
                  : 'Next hop →'}
              </button>
            )}
          </div>
        </section>
      )}
      <div className="counting-reward-trail">
        <CountingStars earned={stars} />
        <span>Collect a star at 2, 5, and 8 hops!</span>
        {state.streak >= 2 && <strong>{state.streak} in a row ✦</strong>}
      </div>
    </main>
  )
}

export function SkipCountingScreen({
  voicePreferences,
  onVoicePreferencesChange,
  onBack,
}: SkipCountingProps) {
  const [progress, setProgress] = useState(loadCountingProgress)
  const [page, setPage] = useState<'setup' | 'learn' | 'play'>('setup')
  const [roundKey, setRoundKey] = useState(0)
  const settings = progress.settings
  const recent = progress.sessions.filter(
    (session) => session.step === settings.step,
  )
  const updateSettings = (patch: Partial<CountingSettings>) => {
    const next = { ...progress, settings: { ...settings, ...patch } }
    setProgress(next)
    saveCountingProgress(next)
  }
  const start = () => {
    setRoundKey((key) => key + 1)
    setPage('play')
  }
  const save = (summary: CountingSummary) => {
    const next = {
      ...progress,
      sessions: [summary, ...progress.sessions].slice(0, 10),
    }
    setProgress(next)
    saveCountingProgress(next)
  }

  return (
    <div className="counting-page">
      <div className="page-shell">
        <AppHeader
          action={
            <button
              className="counting-sound"
              type="button"
              aria-pressed={voicePreferences.enabled}
              onClick={() => {
                if (voicePreferences.enabled) window.speechSynthesis?.cancel()
                onVoicePreferencesChange({
                  ...voicePreferences,
                  enabled: !voicePreferences.enabled,
                })
              }}
            >
              <span aria-hidden="true">
                {voicePreferences.enabled ? '♪' : '♩'}
              </span>{' '}
              Voice {voicePreferences.enabled ? 'on' : 'off'}
            </button>
          }
        />
        {page === 'setup' ? (
          <>
            <ActivityNav active="counting" onBonds={onBack} />
            <main className="counting-main counting-setup">
              <section className="counting-welcome">
                <div className="counting-welcome__copy">
                  <p className="eyebrow">
                    A little adventure in the Number Bond Garden
                  </p>
                  <h1>
                    Little hops. <br />
                    <span>Big number fun.</span>
                  </h1>
                  <p>
                    Meet Pip! Learn to count in jumps,
                    <br className="counting-desktop-break" /> then hop your way
                    to the stars.
                  </p>
                  <div className="counting-welcome__tags">
                    <span>✦ Learn through play</span>
                    <span>★ Grow your confidence</span>
                  </div>
                </div>
                <div className="counting-welcome__art" aria-hidden="true">
                  <span className="counting-art-star counting-art-star--one">
                    ✦
                  </span>
                  <span className="counting-art-star counting-art-star--two">
                    ✧
                  </span>
                  <span className="counting-pip-label">Hi, I’m Pip!</span>
                  <div className="counting-art-ripple" />
                  <div className="counting-art-pad" />
                  <Frog />
                  <span className="counting-art-number counting-art-number--one">
                    {settings.step}
                  </span>
                  <span className="counting-art-number counting-art-number--two">
                    {settings.step * 2}
                  </span>
                  <span className="counting-art-number counting-art-number--three">
                    {settings.step * 3}
                  </span>
                </div>
              </section>
              <div className="counting-setup-grid">
                <section
                  className="counting-config"
                  aria-labelledby="counting-step-heading"
                >
                  <div className="counting-section-title">
                    <span className="counting-section-number">1</span>
                    <div>
                      <h2 id="counting-step-heading">How big is your hop?</h2>
                      <p>Choose a number to count by.</p>
                    </div>
                  </div>
                  <div className="counting-step-options" aria-label="Count by">
                    {COUNTING_STEPS.map((step) => (
                      <button
                        className="counting-step"
                        type="button"
                        aria-label={`Count by ${step}`}
                        aria-pressed={settings.step === step}
                        onClick={() => updateSettings({ step })}
                        key={step}
                      >
                        <strong>{step}</strong>
                        <span>{[2, 5, 10].includes(step) ? '★' : 'hop'}</span>
                      </button>
                    ))}
                  </div>
                  <p className="counting-small">
                    ★ 2, 5, and 10 are lovely places to start.
                  </p>
                  <div
                    className="counting-preview"
                    aria-label={`Counting by ${settings.step} preview`}
                  >
                    {[1, 2, 3, 4].map((multiple) => (
                      <span key={multiple}>
                        {multiple > 1 && <i aria-hidden="true">→</i>}
                        <strong>{multiple * settings.step}</strong>
                      </span>
                    ))}
                    <span aria-hidden="true">…</span>
                  </div>
                </section>
                <section
                  className="counting-config counting-config--pace"
                  aria-labelledby="counting-pace-heading"
                >
                  <div className="counting-section-title">
                    <span className="counting-section-number">2</span>
                    <div>
                      <h2 id="counting-pace-heading">Pick your pace.</h2>
                      <p>Eight little hops in every game.</p>
                    </div>
                  </div>
                  <div
                    className="counting-timer-options"
                    aria-label="Game timer"
                  >
                    {(
                      [
                        {
                          value: 0,
                          title: 'No rush',
                          detail: 'Take your time',
                          icon: '∞',
                        },
                        {
                          value: 120,
                          title: '2 minutes',
                          detail: 'A quick adventure',
                          icon: '◷',
                        },
                        {
                          value: 180,
                          title: '3 minutes',
                          detail: 'A little more time',
                          icon: '◷',
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        type="button"
                        aria-pressed={settings.timer === option.value}
                        className="counting-timer-option"
                        key={option.value}
                        onClick={() => updateSettings({ timer: option.value })}
                      >
                        <span aria-hidden="true">{option.icon}</span>
                        <span>
                          <strong>{option.title}</strong>
                          <small>{option.detail}</small>
                        </span>
                        <i aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <section className="counting-launch">
                <div>
                  <span className="counting-launch__icon" aria-hidden="true">
                    ✿
                  </span>
                  <div>
                    <h2>A little learning. A lot of hopping.</h2>
                    <p>Try it together, then let your little one shine.</p>
                  </div>
                </div>
                <div className="counting-launch__buttons">
                  <button
                    className="counting-secondary"
                    type="button"
                    onClick={() => setPage('learn')}
                  >
                    Learn with Pip
                  </button>
                  <button
                    className="counting-primary"
                    type="button"
                    onClick={start}
                  >
                    Let’s play <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </section>
              <div className="counting-footer-note">
                <span>★ Points for trying. Stars for growing.</span>
                <span>
                  {recent.length
                    ? `Best with ${settings.step}s: ${Math.max(...recent.map((session) => session.points))} points`
                    : 'Every hop is a little win.'}
                </span>
              </div>
              {progress.sessions.length > 0 && (
                <details className="counting-parent">
                  <summary>For grown-ups · recent counting adventures</summary>
                  <p>
                    Last {progress.sessions.length} games on this device. First
                    try means solved without a hint or a missed answer. Stars
                    celebrate practice, including answers learned together.
                  </p>
                  <div className="counting-history-wrap">
                    <table>
                      <caption className="sr-only">
                        Recent skip-counting results
                      </caption>
                      <thead>
                        <tr>
                          <th>Count by</th>
                          <th>First try</th>
                          <th>Solved</th>
                          <th>Hints</th>
                          <th>Shown</th>
                          <th>Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.sessions.map((session, index) => (
                          <tr key={`${session.timestamp}-${index}`}>
                            <th>{session.step}s</th>
                            <td>
                              {session.firstTry}/{session.attempted}
                            </td>
                            <td>
                              {session.solved}/{session.attempted}
                            </td>
                            <td>{session.hints}</td>
                            <td>{session.reveals}</td>
                            <td>{session.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Clear recent Hop & Count results? Your counting settings will stay the same.',
                        )
                      ) {
                        const next = { ...progress, sessions: [] }
                        setProgress(next)
                        saveCountingProgress(next)
                      }
                    }}
                  >
                    Clear counting results
                  </button>
                </details>
              )}
            </main>
          </>
        ) : page === 'learn' ? (
          <CountingLesson
            settings={settings}
            voicePreferences={voicePreferences}
            onBack={() => setPage('setup')}
            onPlay={start}
          />
        ) : (
          <CountingGame
            key={roundKey}
            settings={settings}
            voicePreferences={voicePreferences}
            onSave={save}
            onBack={() => setPage('setup')}
            onAgain={start}
            onLearn={() => setPage('learn')}
          />
        )}
      </div>
    </div>
  )
}
