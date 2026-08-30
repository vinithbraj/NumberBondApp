import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoicePreferences } from '../voice'
import { VOICE_TONE_PROSODY } from '../voice'

function speechIsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof globalThis.SpeechSynthesisUtterance === 'function'
  )
}

function preferredDeviceVoices(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice[] {
  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('en'),
  )
  const languageMatches = englishVoices.length > 0 ? englishVoices : voices
  const localVoices = languageMatches.filter((voice) => voice.localService)
  const candidates = localVoices.length > 0 ? localVoices : languageMatches
  const unique = new Map<string, SpeechSynthesisVoice>()

  for (const voice of candidates) unique.set(voice.voiceURI, voice)

  return [...unique.values()].sort((left, right) => {
    if (left.default !== right.default) return left.default ? -1 : 1
    return left.name.localeCompare(right.name)
  })
}

export interface SpeechFeedbackController {
  isSupported: boolean
  voices: SpeechSynthesisVoice[]
  speak: (text: string) => boolean
  stop: () => void
}

export function useSpeechFeedback(
  preferences: VoicePreferences,
): SpeechFeedbackController {
  const isSupported = speechIsSupported()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const preferencesRef = useRef(preferences)
  const voicesRef = useRef(voices)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  useEffect(() => {
    voicesRef.current = voices
  }, [voices])

  useEffect(() => {
    if (!isSupported) return undefined

    const synth = window.speechSynthesis
    const refreshVoices = () => {
      setVoices(preferredDeviceVoices(synth.getVoices()))
    }

    refreshVoices()
    synth.addEventListener('voiceschanged', refreshVoices)
    return () => synth.removeEventListener('voiceschanged', refreshVoices)
  }, [isSupported])

  const stop = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis?.cancel()
    utteranceRef.current = null
  }, [isSupported])

  const speak = useCallback(
    (text: string): boolean => {
      const current = preferencesRef.current
      if (!isSupported || !current.enabled || text.trim() === '') return false

      const synth = window.speechSynthesis
      if (!synth) return false
      const utterance = new SpeechSynthesisUtterance(text)
      const prosody = VOICE_TONE_PROSODY[current.tone]
      const liveVoices =
        voicesRef.current.length > 0
          ? voicesRef.current
          : preferredDeviceVoices(synth.getVoices())
      const selectedVoice = current.voiceURI
        ? liveVoices.find(
            (voice) => voice.voiceURI === current.voiceURI,
          )
        : liveVoices.find((voice) => voice.default) ?? liveVoices[0]
      const fallbackVoice =
        selectedVoice ??
        liveVoices.find((voice) => voice.default) ??
        liveVoices[0]

      utterance.rate = prosody.rate
      utterance.pitch = prosody.pitch
      utterance.volume = prosody.volume
      utterance.lang = fallbackVoice?.lang ?? 'en-US'
      if (fallbackVoice) utterance.voice = fallbackVoice

      utterance.onend = () => {
        if (utteranceRef.current === utterance) utteranceRef.current = null
      }
      utterance.onerror = () => {
        if (utteranceRef.current === utterance) utteranceRef.current = null
      }

      synth.cancel()
      utteranceRef.current = utterance
      synth.speak(utterance)
      return true
    },
    [isSupported],
  )

  useEffect(() => stop, [stop])

  useEffect(() => {
    if (!isSupported) return undefined
    const stopWhenHidden = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', stopWhenHidden)
    return () => document.removeEventListener('visibilitychange', stopWhenHidden)
  }, [isSupported, stop])

  return { isSupported, voices, speak, stop }
}
