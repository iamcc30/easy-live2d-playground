import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AnimeChatInterface from '../AnimeChatInterface.vue'

// 模拟语音服务
vi.mock('@/utils/speech', () => ({
  speechService: {
    isRecognitionSupported: vi.fn(() => true),
    isSynthesisSupported: vi.fn(() => true),
    startRecognition: vi.fn(),
    stopRecognition: vi.fn(),
    speak: vi.fn((text, lang, pitch, rate, volume, onStart, onEnd, onError) => {
      if (onStart) onStart()
      setTimeout(() => {
        if (onEnd) onEnd()
      }, 100)
    }),
    stopSpeaking: vi.fn(),
    getVoices: vi.fn(() => [])
  }
}))

// 模拟浮动元素组件
vi.mock('@/components/FloatingElements.vue', () => ({
  default: {
    name: 'FloatingElements',
    template: '<div class="floating-elements-mock">✨</div>'
  }
}))

describe('AnimeChatInterface', () => {
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

  it('renders anime chat interface correctly', () => {
    const wrapper = mount(AnimeChatInterface)

    expect(wrapper.find('.anime-chat-interface')).toBeTruthy()
    expect(wrapper.find('.messages-container')).toBeTruthy()
    expect(wrapper.find('.input-area')).toBeTruthy()
    expect(wrapper.find('.message-input')).toBeTruthy()
    expect(wrapper.find('.send-button')).toBeTruthy()
  })

  it('shows floating elements decoration', () => {
    const wrapper = mount(AnimeChatInterface)

    expect(wrapper.find('.floating-elements-mock')).toBeTruthy()
  })

  it('has anime-style UI elements', () => {
    const wrapper = mount(AnimeChatInterface)

    // 检查二次元风格元素
    expect(wrapper.find('.top-decoration')).toBeTruthy()
    expect(wrapper.find('.center-gem')).toBeTruthy()
    expect(wrapper.find('.bottom-decoration')).toBeTruthy()
  })

  it('sends message with anime-style response', async () => {
    const wrapper = mount(AnimeChatInterface)

    const input = wrapper.find('.message-input')
    const button = wrapper.find('.send-button')

    await input.setValue('Hello')
    await button.trigger('click')

    expect(input.element.value).toBe('')
  })

  it('shows voice controls with anime style', () => {
    const wrapper = mount(AnimeChatInterface)

    expect(wrapper.findComponent({ name: 'AnimeVoiceControls' })).toBeTruthy()
  })

  it('shows chat history with anime style', () => {
    const wrapper = mount(AnimeChatInterface)

    expect(wrapper.findComponent({ name: 'AnimeChatHistory' })).toBeTruthy()
  })

  it('handles voice input correctly', async () => {
    const wrapper = mount(AnimeChatInterface)

    const voiceControls = wrapper.findComponent({ name: 'AnimeVoiceControls' })
    expect(voiceControls).toBeTruthy()
  })

  it('displays welcome message for new users', async () => {
    const wrapper = mount(AnimeChatInterface)

    // 等待欢迎消息出现
    await new Promise(resolve => setTimeout(resolve, 2000))

    const messages = wrapper.findAllComponents({ name: 'AnimeChatMessage' })
    expect(messages.length).toBeGreaterThan(0)
  })

  it('shows decorative elements on hover', async () => {
    const wrapper = mount(AnimeChatInterface)

    await wrapper.trigger('click')
    expect(wrapper.vm.showFloatingElements).toBe(true)
  })
})