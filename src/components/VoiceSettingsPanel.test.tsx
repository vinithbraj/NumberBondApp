import { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installSpeechSynthesisMock,
  makeVoice,
  MockSpeechSynthesisUtterance,
} from '../test/speechSynthesisMock'
import type { VoicePreferences } from '../voice'
import { DEFAULT_VOICE_PREFERENCES, VOICE_TONE_PROSODY } from '../voice'
import { VoiceSettingsPanel } from './VoiceSettingsPanel'

function VoiceHarness() {
  const [preferences, setPreferences] = useState<VoicePreferences>({
    ...DEFAULT_VOICE_PREFERENCES,
  })
  return (
    <VoiceSettingsPanel
      preferences={preferences}
      onChange={setPreferences}
    />
  )
}

describe('VoiceSettingsPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'speechSynthesis')
  })

  it('gracefully explains when speech is unavailable', () => {
    render(<VoiceHarness />)

    expect(
      screen.getByText(/Voice feedback is not available in this browser/),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('lists installed English voices and previews the selected tone', async () => {
    const localEnglishVoice = makeVoice()
    const remoteEnglishVoice = makeVoice({
      default: false,
      localService: false,
      name: 'Remote voice',
      voiceURI: 'voice:remote',
    })
    const localFrenchVoice = makeVoice({
      default: false,
      lang: 'fr-FR',
      name: 'Amélie',
      voiceURI: 'voice:amelie',
    })
    const speech = installSpeechSynthesisMock([
      localEnglishVoice,
      remoteEnglishVoice,
      localFrenchVoice,
    ])
    const user = userEvent.setup()
    render(<VoiceHarness />)

    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Samantha/ })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('option', { name: /Remote voice/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Amélie/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cheerful/ }))
    await user.selectOptions(
      screen.getByLabelText('Choose a teacher voice'),
      'voice:samantha',
    )
    await user.click(screen.getByRole('button', { name: 'Hear a preview' }))

    const utterance = speech.synth.speak.mock.calls.at(-1)?.[0] as
      | MockSpeechSynthesisUtterance
      | undefined
    expect(utterance).toBeDefined()
    expect(utterance?.voice).toBe(localEnglishVoice)
    expect(utterance?.rate).toBe(VOICE_TONE_PROSODY.cheerful.rate)
    expect(utterance?.pitch).toBe(VOICE_TONE_PROSODY.cheerful.pitch)
    speech.restore()
  })

  it('stops speech and disables controls when voice is switched off', async () => {
    const speech = installSpeechSynthesisMock()
    const user = userEvent.setup()
    render(<VoiceHarness />)

    await user.click(screen.getByRole('checkbox'))
    expect(speech.synth.cancel).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Warm/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hear a preview' })).toBeDisabled()
    speech.restore()
  })

  it('updates the picker when browser voices arrive after page load', async () => {
    const voices: SpeechSynthesisVoice[] = []
    const speech = installSpeechSynthesisMock(voices)
    render(<VoiceHarness />)

    expect(screen.queryByRole('option', { name: /Samantha/ })).not.toBeInTheDocument()
    voices.push(makeVoice())
    act(() => speech.emitVoicesChanged())

    expect(
      await screen.findByRole('option', { name: /Samantha/ }),
    ).toBeInTheDocument()
    speech.restore()
  })
})
