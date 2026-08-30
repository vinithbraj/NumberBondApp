import { vi } from 'vitest'

export class MockSpeechSynthesisUtterance {
  text: string
  lang = ''
  pitch = 1
  rate = 1
  volume = 1
  voice: SpeechSynthesisVoice | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(text = '') {
    this.text = text
  }
}

export function makeVoice(
  overrides: Partial<SpeechSynthesisVoice> = {},
): SpeechSynthesisVoice {
  return {
    default: true,
    lang: 'en-US',
    localService: true,
    name: 'Samantha',
    voiceURI: 'voice:samantha',
    ...overrides,
  }
}

export function installSpeechSynthesisMock(
  voices: SpeechSynthesisVoice[] = [makeVoice()],
) {
  const listeners = new Set<EventListenerOrEventListenerObject>()
  const synth = {
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    speak: vi.fn(),
    addEventListener: vi.fn(
      (event: string, listener: EventListenerOrEventListenerObject) => {
        if (event === 'voiceschanged') listeners.add(listener)
      },
    ),
    removeEventListener: vi.fn(
      (event: string, listener: EventListenerOrEventListenerObject) => {
        if (event === 'voiceschanged') listeners.delete(listener)
      },
    ),
  }

  vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance)
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synth,
  })

  return {
    synth,
    emitVoicesChanged() {
      for (const listener of listeners) {
        if (typeof listener === 'function') {
          listener(new Event('voiceschanged'))
        } else {
          listener.handleEvent(new Event('voiceschanged'))
        }
      }
    },
    restore() {
      vi.unstubAllGlobals()
      Reflect.deleteProperty(window, 'speechSynthesis')
    },
  }
}
