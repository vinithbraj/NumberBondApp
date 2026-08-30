import type {
  DiagramOrientation,
  ExerciseMode,
  PracticeSettings,
  PresetId,
  SessionLength,
} from '../domain/types'
import { MAX_WHOLE, MIN_WHOLE, PRESET_SETTINGS } from '../domain/types'
import type { VoicePreferences } from '../voice'
import { AppHeader } from './AppHeader'
import { VoiceSettingsPanel } from './VoiceSettingsPanel'

interface SetupScreenProps {
  settings: PracticeSettings
  voicePreferences: VoicePreferences
  historyCount: number
  error: string
  onSettingsChange: (settings: PracticeSettings) => void
  onVoicePreferencesChange: (preferences: VoicePreferences) => void
  onStart: () => void
  onTutorial: () => void
  onProgress: () => void
}

const PRESET_DETAILS: Array<{
  id: Exclude<PresetId, 'custom'>
  title: string
  range: string
  description: string
}> = [
  {
    id: 'beginner',
    title: 'Beginner',
    range: 'Wholes to 5',
    description: 'Put two parts together.',
  },
  {
    id: 'standard',
    title: 'Standard',
    range: 'Wholes to 10',
    description: 'Find parts and wholes.',
  },
  {
    id: 'challenge',
    title: 'Challenge',
    range: 'Wholes to 20',
    description: 'Practice with bigger numbers.',
  },
]

const SESSION_LENGTHS: Array<{ value: SessionLength; label: string }> = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 'endless', label: 'Endless' },
]

const NUMBER_OPTIONS = Array.from(
  { length: MAX_WHOLE - MIN_WHOLE + 1 },
  (_, index) => index + MIN_WHOLE,
)

function settingWithPreset(
  current: PracticeSettings,
  preset: Exclude<PresetId, 'custom'>,
): PracticeSettings {
  return {
    ...PRESET_SETTINGS[preset],
    sessionLength: current.sessionLength,
    orientation: current.orientation,
  }
}

export function SetupScreen({
  settings,
  voicePreferences,
  historyCount,
  error,
  onSettingsChange,
  onVoicePreferencesChange,
  onStart,
  onTutorial,
  onProgress,
}: SetupScreenProps) {
  const update = (patch: Partial<PracticeSettings>) =>
    onSettingsChange({ ...settings, ...patch })

  const openCustom = () => update({ preset: 'custom' })

  return (
    <div className="page-shell">
      <AppHeader
        action={
          <button className="button button--small" type="button" onClick={onProgress}>
            Progress{historyCount > 0 ? ` (${historyCount})` : ''}
          </button>
        }
      />
      <main className="setup-layout">
        <section className="setup-intro">
          <p className="eyebrow">Ready to grow your number sense?</p>
          <h1>Choose a practice level.</h1>
          <p className="lead-copy">
            Take your time. Counting hints are always nearby.
          </p>
        </section>

        <section aria-labelledby="level-heading">
          <h2 className="sr-only" id="level-heading">
            Difficulty level
          </h2>
          <div className="level-grid">
            {PRESET_DETAILS.map((preset) => {
              const selected = settings.preset === preset.id
              return (
                <button
                  aria-pressed={selected}
                  className={`level-card level-card--${preset.id} ${
                    selected ? 'level-card--selected' : ''
                  }`}
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    onSettingsChange(settingWithPreset(settings, preset.id))
                  }
                >
                  <span className="level-card__symbol" aria-hidden="true">
                    {preset.id === 'beginner'
                      ? '●'
                      : preset.id === 'standard'
                        ? '● ●'
                        : '● ● ●'}
                  </span>
                  <strong>{preset.title}</strong>
                  <span>{preset.range}</span>
                  <small>{preset.description}</small>
                </button>
              )
            })}

            <button
              aria-pressed={settings.preset === 'custom'}
              className={`level-card level-card--custom ${
                settings.preset === 'custom' ? 'level-card--selected' : ''
              }`}
              type="button"
              onClick={openCustom}
            >
              <span className="level-card__symbol" aria-hidden="true">
                ⚙
              </span>
              <strong>Custom</strong>
              <span>Your choices</span>
              <small>Set the range and question type.</small>
            </button>
          </div>
        </section>

        {settings.preset === 'custom' && (
          <section className="settings-panel" aria-labelledby="custom-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Adult settings</p>
                <h2 id="custom-heading">Custom practice</h2>
              </div>
            </div>
            <div className="settings-grid">
              <label className="field">
                <span>Smallest whole</span>
                <select
                  value={settings.minWhole}
                  onChange={(event) => {
                    const minWhole = Number(event.target.value)
                    update({
                      minWhole,
                      maxWhole: Math.max(settings.maxWhole, minWhole),
                    })
                  }}
                >
                  {NUMBER_OPTIONS.map((number) => (
                    <option value={number} key={number}>
                      {number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Largest whole</span>
                <select
                  value={settings.maxWhole}
                  onChange={(event) => {
                    const maxWhole = Number(event.target.value)
                    update({
                      maxWhole,
                      minWhole: Math.min(settings.minWhole, maxWhole),
                    })
                  }}
                >
                  {NUMBER_OPTIONS.map((number) => (
                    <option value={number} key={number}>
                      {number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field--wide">
                <span>What is missing?</span>
                <select
                  value={settings.exerciseMode}
                  onChange={(event) =>
                    update({ exerciseMode: event.target.value as ExerciseMode })
                  }
                >
                  <option value="missing-whole">The whole</option>
                  <option value="missing-part">A part</option>
                  <option value="mixed">Parts and wholes</option>
                </select>
              </label>
              <label className="toggle-field field--wide">
                <input
                  checked={settings.zeroPolicy === 'allow'}
                  type="checkbox"
                  onChange={(event) =>
                    update({ zeroPolicy: event.target.checked ? 'allow' : 'exclude' })
                  }
                />
                <span className="toggle-field__control" aria-hidden="true" />
                <span>
                  <strong>Include zero as a part</strong>
                  <small>For example, 5 = 5 + 0</small>
                </span>
              </label>
            </div>
          </section>
        )}

        <VoiceSettingsPanel
          preferences={voicePreferences}
          onChange={onVoicePreferencesChange}
        />

        <section className="settings-panel" aria-labelledby="session-heading">
          <div className="settings-row">
            <div>
              <p className="eyebrow">Practice session</p>
              <h2 id="session-heading">How many questions?</h2>
            </div>
            <div className="choice-group" aria-label="Session length">
              {SESSION_LENGTHS.map((option) => (
                <button
                  aria-pressed={settings.sessionLength === option.value}
                  className="choice-button"
                  key={option.label}
                  type="button"
                  onClick={() => update({ sessionLength: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row settings-row--bordered">
            <div>
              <p className="eyebrow">Diagram layout</p>
              <h2>Where should the whole go?</h2>
            </div>
            <div className="choice-group" aria-label="Diagram orientation">
              {(
                [
                  ['whole-top', 'Whole above'],
                  ['whole-bottom', 'Whole below'],
                ] as Array<[DiagramOrientation, string]>
              ).map(([value, label]) => (
                <button
                  aria-pressed={settings.orientation === value}
                  className="choice-button"
                  key={value}
                  type="button"
                  onClick={() => update({ orientation: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <p className="setup-error" role="alert">
            {error}
          </p>
        )}

        <div className="setup-actions">
          <button className="text-button" type="button" onClick={onTutorial}>
            How it works
          </button>
          <button className="button button--primary button--large" type="button" onClick={onStart}>
            Start practice
          </button>
        </div>
      </main>
    </div>
  )
}
