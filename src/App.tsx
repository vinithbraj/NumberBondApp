import { useState } from 'react'
import { buildExercisePool } from './domain/exerciseGenerator'
import type { PracticeSettings, SessionSummary } from './domain/types'
import { PracticeScreen } from './components/PracticeScreen'
import { ProgressScreen } from './components/ProgressScreen'
import { SetupScreen } from './components/SetupScreen'
import { SummaryScreen } from './components/SummaryScreen'
import { TutorialScreen } from './components/TutorialScreen'
import {
  addSessionSummary,
  clearProgress,
  loadAppState,
  saveSettings,
  setTutorialCompleted,
} from './storage'
import type { VoicePreferences } from './voice'
import {
  loadVoicePreferences,
  saveVoicePreferences,
} from './voice'

type AppView = 'tutorial' | 'setup' | 'practice' | 'summary' | 'progress'

export default function App() {
  const [initialState] = useState(loadAppState)
  const [initialVoicePreferences] = useState(loadVoicePreferences)
  const [settings, setSettings] = useState<PracticeSettings>(
    initialState.settings,
  )
  const [sessions, setSessions] = useState<SessionSummary[]>(
    initialState.sessions,
  )
  const [view, setView] = useState<AppView>(
    initialState.tutorialCompleted ? 'setup' : 'tutorial',
  )
  const [tutorialReplay, setTutorialReplay] = useState(false)
  const [sessionSettings, setSessionSettings] = useState<PracticeSettings>(
    initialState.settings,
  )
  const [lastSummary, setLastSummary] = useState<SessionSummary | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [setupError, setSetupError] = useState('')
  const [voicePreferences, setVoicePreferences] =
    useState<VoicePreferences>(initialVoicePreferences)
  const [sessionVoicePreferences, setSessionVoicePreferences] =
    useState<VoicePreferences>(initialVoicePreferences)

  const updateSettings = (next: PracticeSettings) => {
    setSettings(next)
    saveSettings(next)
    setSetupError('')
  }

  const finishTutorial = () => {
    setTutorialCompleted(true)
    setTutorialReplay(false)
    setView('setup')
  }

  const updateVoicePreferences = (next: VoicePreferences) => {
    setVoicePreferences(next)
    saveVoicePreferences(next)
  }

  const startPractice = (chosenSettings = settings) => {
    if (buildExercisePool(chosenSettings).length === 0) {
      setSetupError(
        'That range has no number bonds without zero. Include zero or choose a larger whole.',
      )
      setView('setup')
      return
    }
    saveSettings(chosenSettings)
    setSettings(chosenSettings)
    setSessionSettings({ ...chosenSettings })
    setSessionVoicePreferences({ ...voicePreferences })
    setSetupError('')
    setSessionKey((current) => current + 1)
    setView('practice')
  }

  const completeSession = (summary: SessionSummary) => {
    if (summary.questionsCompleted === 0) {
      setView('setup')
      return
    }
    const nextState = addSessionSummary(summary)
    setSessions(nextState.sessions)
    setLastSummary(summary)
    setView('summary')
  }

  const resetProgress = () => {
    if (
      !window.confirm(
        'Reset all recent practice results? Your settings will stay the same.',
      )
    ) {
      return
    }
    const nextState = clearProgress()
    setSessions(nextState.sessions)
  }

  if (view === 'tutorial') {
    return (
      <TutorialScreen
        orientation={settings.orientation}
        replay={tutorialReplay}
        onComplete={finishTutorial}
        onExit={() => {
          if (!tutorialReplay) setTutorialCompleted(true)
          setTutorialReplay(false)
          setView('setup')
        }}
      />
    )
  }

  if (view === 'practice') {
    return (
      <PracticeScreen
        key={sessionKey}
        settings={sessionSettings}
        voicePreferences={sessionVoicePreferences}
        onComplete={completeSession}
        onExit={() => setView('setup')}
      />
    )
  }

  if (view === 'summary' && lastSummary) {
    return (
      <SummaryScreen
        summary={lastSummary}
        onChangeSettings={() => setView('setup')}
        onPracticeAgain={() => startPractice(lastSummary.settings)}
        onProgress={() => setView('progress')}
      />
    )
  }

  if (view === 'progress') {
    return (
      <ProgressScreen
        sessions={sessions}
        onBack={() => setView('setup')}
        onClear={resetProgress}
      />
    )
  }

  return (
    <SetupScreen
      error={setupError}
      historyCount={sessions.length}
      settings={settings}
      voicePreferences={voicePreferences}
      onProgress={() => setView('progress')}
      onSettingsChange={updateSettings}
      onVoicePreferencesChange={updateVoicePreferences}
      onStart={() => startPractice()}
      onTutorial={() => {
        setTutorialReplay(true)
        setView('tutorial')
      }}
    />
  )
}
