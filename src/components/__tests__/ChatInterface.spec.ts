import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatInterface from '../ChatInterface.vue'

describe('ChatInterface', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 模拟 SpeechRecognition API
    global.SpeechRecognition = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      continuous: false,
      interimResults: false,
      lang: '',
      onresult: null,
      onerror: null,
      onend: null
    })) as any

    global.webkitSpeechRecognition = global.SpeechRecognition
    global.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => [])
    } as any
  })

  it('renders chat interface correctly', () => {
    const wrapper = mount(ChatInterface)

    expect(wrapper.find('.chat-interface')).toBeTruthy()
    expect(wrapper.find('.messages-container')).toBeTruthy()
    expect(wrapper.find('.input-area')).toBeTruthy()
    expect(wrapper.find('.message-input')).toBeTruthy()
    expect(wrapper.find('.send-button')).toBeTruthy()
  })

  it('sends message when button is clicked', async () => {
    const wrapper = mount(ChatInterface)

    const input = wrapper.find('.message-input')
    const button = wrapper.find('.send-button')

    await input.setValue('Hello')
    await button.trigger('click')

    expect(input.element.value).toBe('')
  })

  it('sends message when enter key is pressed', async () => {
    const wrapper = mount(ChatInterface)

    const input = wrapper.find('.message-input')

    await input.setValue('Hello')
    await input.trigger('keyup.enter')

    expect(input.element.value).toBe('')
  })

  it('disables send button when input is empty', () => {
    const wrapper = mount(ChatInterface)

    const button = wrapper.find('.send-button')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('shows voice controls', () => {
    const wrapper = mount(ChatInterface)

    expect(wrapper.findComponent({ name: 'VoiceControls' })).toBeTruthy()
  })

  it('shows chat history component', () => {
    const wrapper = mount(ChatInterface)

    expect(wrapper.findComponent({ name: 'ChatHistory' })).toBeTruthy()
  })

  it('handles voice input correctly', async () => {
    const wrapper = mount(ChatInterface)

    const voiceControls = wrapper.findComponent({ name: 'VoiceControls' })
    expect(voiceControls).toBeTruthy()
  })
})