import type { VoicePreferences, VoiceTone } from '../voice'
import { useSpeechFeedback } from '../hooks/useSpeechFeedback'

interface VoiceSettingsPanelProps {
  preferences: VoicePreferences
  onChange: (preferences: VoicePreferences) => void
}

const TONES: Array<{
  value: VoiceTone
  label: string
  description: string
}> = [
  { value: 'warm', label: 'Warm', description: 'Friendly and steady' },
  { value: 'cheerful', label: 'Cheerful', description: 'Bright and lively' },
  { value: 'calm', label: 'Calm', description: 'Slow and gentle' },
]

const PREVIEW_TEXT =
  'Hi! I’ll help you grow your number sense. Let’s find a number bond together.'

export function VoiceSettingsPanel({
  preferences,
  onChange,
}: VoiceSettingsPanelProps) {
  const { isSupported, voices, speak, stop } =
    useSpeechFeedback(preferences)
  const update = (patch: Partial<VoicePreferences>) =>
    onChange({ ...preferences, ...patch })
  const selectedVoiceURI =
    preferences.voiceURI &&
    voices.some((voice) => voice.voiceURI === preferences.voiceURI)
      ? preferences.voiceURI
      : ''

  return (
    <section className="settings-panel voice-settings" aria-labelledby="voice-heading">
      <div className="settings-row">
        <div>
          <p className="eyebrow">Teacher voice</p>
          <h2 id="voice-heading">Read questions and feedback aloud</h2>
          <p className="settings-description">
            Uses a voice supplied by this browser. No recording is made.
          </p>
        </div>
        <label className="toggle-field voice-settings__toggle">
          <input
            checked={preferences.enabled && isSupported}
            disabled={!isSupported}
            type="checkbox"
            onChange={(event) => {
              stop()
              update({ enabled: event.target.checked })
            }}
          />
          <span className="toggle-field__control" aria-hidden="true" />
          <span>
            <strong>
              {!isSupported
                ? 'Voice unavailable'
                : preferences.enabled
                  ? 'Voice on'
                  : 'Voice off'}
            </strong>
          </span>
        </label>
      </div>

      {!isSupported ? (
        <p className="voice-note" role="note">
          Voice feedback is not available in this browser. Every question will
          still appear on screen.
        </p>
      ) : (
        <div className={`voice-settings__controls ${preferences.enabled ? '' : 'voice-settings__controls--disabled'}`}>
          <fieldset disabled={!preferences.enabled}>
            <legend>Choose a tone</legend>
            <div className="tone-grid">
              {TONES.map((tone) => (
                <button
                  aria-pressed={preferences.tone === tone.value}
                  className="tone-button"
                  key={tone.value}
                  type="button"
                  onClick={() => {
                    stop()
                    update({ tone: tone.value })
                  }}
                >
                  <strong>{tone.label}</strong>
                  <small>{tone.description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="voice-picker-row">
            <label className="field voice-picker">
              <span>Choose a teacher voice</span>
              <select
                disabled={!preferences.enabled}
                value={selectedVoiceURI}
                onChange={(event) => {
                  stop()
                  update({ voiceURI: event.target.value || null })
                }}
              >
                <option value="">Automatic device voice</option>
                {voices.map((voice) => (
                  <option value={voice.voiceURI} key={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button--secondary voice-preview"
              disabled={!preferences.enabled}
              type="button"
              onClick={() => speak(PREVIEW_TEXT)}
            >
              Hear a preview
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
