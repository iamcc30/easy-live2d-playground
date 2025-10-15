import { errorHandler } from './errorHandler'

export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

export class SpeechService {
  private recognition: SpeechRecognition | null = null
  private synthesis: SpeechSynthesis = window.speechSynthesis
  private voices: SpeechSynthesisVoice[] = []

  constructor() {
    this.initSpeechRecognition()
    this.loadVoices()
  }

  // 初始化语音识别
  private initSpeechRecognition() {
    try {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        this.recognition = new SpeechRecognition()

        // 优化设置
        this.recognition.continuous = true
        this.recognition.interimResults = true
        this.recognition.lang = 'zh-CN'

        // 设置音频捕获参数
        if ('webkitSpeechRecognition' in window) {
          (this.recognition as any).webkitSpeechRecognition = true
        }

        // 加载语音列表
        this.synthesis.onvoiceschanged = () => {
          this.loadVoices()
        }

        errorHandler.showSuccess('语音识别初始化成功', '可以开始使用语音输入功能')
      } else {
        errorHandler.handleSpeechRecognitionError('recognition-unsupported')
      }
    } catch (error) {
      console.error('语音识别初始化失败:', error)
      errorHandler.handleSpeechRecognitionError('recognition-unsupported')
    }

    // 加载语音列表
    if (this.synthesis && this.synthesis.onvoiceschanged) {
      this.synthesis.onvoiceschanged = () => {
        this.loadVoices()
      }
    }
  }

  // 加载语音合成声音
  private loadVoices() {
    try {
      if (this.synthesis && this.synthesis.getVoices) {
        this.voices = this.synthesis.getVoices()
      }
    } catch (error) {
      console.warn('语音合成初始化失败:', error)
      this.voices = []
    }
  }

  // 开始语音识别
  startRecognition(
    onResult: (result: SpeechRecognitionResult) => void,
    onError: (error: string) => void,
    onEnd: () => void,
    lang: string = 'zh-CN'
  ): void {
    if (!this.recognition) {
      onError('语音识别不支持')
      return
    }

    this.recognition.lang = lang

    this.recognition.onresult = (event) => {
      const results = event.results
      const result = results[results.length - 1]
      const transcript = result[0].transcript
      const confidence = result[0].confidence

      onResult({
        transcript,
        confidence,
        isFinal: result.isFinal
      })
    }

    this.recognition.onerror = (event) => {
      const error = event.error
      let errorMessage = '语音识别错误'

      switch (error) {
        case 'no-speech':
          errorMessage = '未检测到语音，请说话后再试'
          break
        case 'audio-capture':
          errorMessage = '无法访问麦克风，请检查权限'
          break
        case 'network':
          errorMessage = '网络连接失败，请检查网络'
          break
        case 'not-allowed':
          errorMessage = '麦克风权限被拒绝'
          break
        case 'service-not-allowed':
          errorMessage = '语音识别服务不可用'
          break
        default:
          errorMessage = `语音识别失败: ${error}`
      }

      onError(errorMessage)
      errorHandler.handleSpeechRecognitionError(error)
    }

    this.recognition.onend = () => {
      onEnd()
    }

    this.recognition.start()
  }

  // 停止语音识别
  stopRecognition(): void {
    if (this.recognition) {
      this.recognition.stop()
    }
  }

  // 语音合成
  speak(
    text: string,
    lang: string = 'zh-CN',
    pitch: number = 1,
    rate: number = 1,
    volume: number = 1,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (error: string) => void
  ): void {
    // 停止当前播放
    this.synthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.pitch = pitch
    utterance.rate = rate
    utterance.volume = volume

    // 选择合适的声音
    const voice = this.voices.find(v => v.lang.includes(lang.substring(0, 2))) || this.voices[0]
    if (voice) {
      utterance.voice = voice
    }

    utterance.onstart = () => {
      onStart?.()
    }

    utterance.onend = () => {
      onEnd?.()
    }

    utterance.onerror = (event) => {
      onError?.(`语音合成错误: ${event.error}`)
    }

    this.synthesis.speak(utterance)
  }

  // 停止语音合成
  stopSpeaking(): void {
    this.synthesis.cancel()
  }

  // 获取可用的语音列表
  getVoices(): SpeechSynthesisVoice[] {
    return this.voices
  }

  // 检查语音识别支持
  isRecognitionSupported(): boolean {
    return !!this.recognition
  }

  // 检查语音合成支持
  isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && !!window.speechSynthesis
  }
}

// 创建单例实例
export const speechService = new SpeechService()