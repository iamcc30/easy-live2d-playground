import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ChatStorage } from '@/utils/storage'
import { websocketService } from '@/services/websocket'
import { audioRecordingService } from '@/services/audioRecording'
import { audioPlaybackService } from '@/services/audioPlayback'
import type { ConnectionState, ListenMode, TTSMessage, LLMMessage } from '@/types/websocket'
import { errorHandler } from '@/utils/errorHandler'

export interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  audioUrl?: string
  emotion?: string
}

export interface VoiceSettings {
  lang: string
  pitch: number
  rate: number
  volume: number
}

export const useChatStore = defineStore('chat', () => {
  // 消息列表
  const messages = ref<ChatMessage[]>([])

  // Websocket 连接状态 (use service state directly to avoid sync issues)
  const connectionState = computed(() => websocketService.getConnectionState())
  const isConnected = computed(() => websocketService.isConnected())

  // 语音识别设置
  const isListening = ref(false)
  const listenMode = ref<ListenMode>('auto')
  const recognitionLang = ref('zh-CN')

  // 语音合成设置
  const voiceSettings = ref<VoiceSettings>({
    lang: 'zh-CN',
    pitch: 1,
    rate: 1,
    volume: 1
  })

  // 当前输入
  const currentInput = ref('')

  // 是否正在播放语音
  const isSpeaking = ref(false)

  // 当前情感状态
  const currentEmotion = ref<string>('normal')

  // TTS 文本缓存
  const currentTTSText = ref<string>('')

  // 获取最新消息
  const latestMessage = computed(() => messages.value[messages.value.length - 1])

  // 获取统计信息
  const stats = computed(() => ChatStorage.getHistoryStats(messages.value))

  // 初始化时加载历史记录
  function loadHistory() {
    const history = ChatStorage.loadHistory()
    messages.value = history
  }

  // 保存到历史记录
  function saveHistory() {
    ChatStorage.saveHistory(messages.value)
  }

  // 添加消息
  function addMessage(text: string, isUser: boolean = true, audioUrl?: string, emotion?: string) {
    const message: ChatMessage = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
      audioUrl,
      emotion
    }
    messages.value.push(message)

    // 保存到本地存储
    saveHistory()

    return message
  }

  // 清空消息
  function clearMessages() {
    messages.value = []
    ChatStorage.clearHistory()
  }

  // 设置输入
  function setInput(text: string) {
    currentInput.value = text
  }

  // 清除输入
  function clearInput() {
    currentInput.value = ''
  }

  // 更新语音设置
  function updateVoiceSettings(settings: Partial<VoiceSettings>) {
    voiceSettings.value = { ...voiceSettings.value, ...settings }
  }

  // 设置语音识别状态
  function setListening(listening: boolean) {
    isListening.value = listening
  }

  // 设置语音播放状态
  function setSpeaking(speaking: boolean) {
    isSpeaking.value = speaking
  }

  // 设置情感状态
  function setEmotion(emotion: string) {
    currentEmotion.value = emotion
  }

  // 导出聊天记录
  function exportHistory(): string {
    return ChatStorage.exportHistory(messages.value)
  }

  // 导入聊天记录
  function importHistory(jsonString: string): boolean {
    try {
      const importedMessages = ChatStorage.importHistory(jsonString)
      if (importedMessages.length > 0) {
        messages.value = importedMessages
        saveHistory()
        return true
      }
    }
    catch (error) {
      console.warn('导入聊天记录失败:', error)
    }
    return false
  }

  // ==== Websocket Integration ====

  /**
   * Connect to Websocket server
   */
  async function connectWebsocket(): Promise<void> {
    try {
      // Initialize services
      await audioRecordingService.initialize()
      await audioPlaybackService.initialize()

      // Setup event handlers and connect
      await websocketService.connect({
        onConnected: handleWebsocketConnected,
        onDisconnected: handleWebsocketDisconnected,
        onTTS: handleTTSMessage,
        onLLM: handleLLMMessage,
        onAudioData: handleAudioData,
        onError: handleWebsocketError
      })

      errorHandler.showSuccess('连接成功', 'Websocket连接已建立')
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errorHandler.showErrorMessage('连接失败', errorMessage)
      throw error
    }
  }

  /**
   * Disconnect from Websocket server
   */
  function disconnectWebsocket(): void {
    websocketService.disconnect()
    audioRecordingService.dispose()
    audioPlaybackService.dispose()
  }

  /**
   * Start voice listening
   */
  async function startVoiceListen(mode: ListenMode = 'auto'): Promise<void> {
    if (!isConnected.value) {
      errorHandler.showErrorMessage('未连接', '请先连接到服务器')
      return
    }

    try {
      // Start recording (now async with OPUS encoder initialization)
      await audioRecordingService.startRecording((audioData) => {
        websocketService.sendAudioData(audioData)
      })

      // Send listen start message
      websocketService.startListen(mode)
      listenMode.value = mode
      isListening.value = true

      console.log('🎤 Started voice listening')
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errorHandler.showErrorMessage('启动录音失败', errorMessage)
      throw error
    }
  }

  /**
   * Stop voice listening
   */
  function stopVoiceListen(): void {
    audioRecordingService.stopRecording()
    websocketService.stopListen()
    isListening.value = false

    console.log('🛑 Stopped voice listening')
  }

  /**
   * Handle Websocket connected event
   */
  function handleWebsocketConnected(): void {
    console.log('✅ Websocket connected')
  }

  /**
   * Handle Websocket disconnected event
   */
  function handleWebsocketDisconnected(): void {
    console.log('🔌 Websocket disconnected')
    isListening.value = false
    isSpeaking.value = false
  }

  /**
   * Handle TTS message from server
   */
  function handleTTSMessage(message: TTSMessage): void {
    console.log('🔊 TTS message:', message.state, message.text)

    if (message.state === 'sentence_start' && message.text) {
      // Add AI response message
      currentTTSText.value = message.text
      addMessage(message.text, false, undefined, currentEmotion.value)
    }
    else if (message.state === 'start') {
      isSpeaking.value = true
      audioPlaybackService.setCallbacks(
        () => isSpeaking.value = true,
        () => isSpeaking.value = false
      )
    }
    else if (message.state === 'stop') {
      isSpeaking.value = false
      currentTTSText.value = ''
    }
  }

  /**
   * Handle LLM emotion message from server
   */
  function handleLLMMessage(message: LLMMessage): void {
    console.log('😊 LLM emotion:', message.emotion)
    setEmotion(message.emotion)
  }

  /**
   * Handle audio data from server
   */
  function handleAudioData(data: ArrayBuffer): void {
    console.log(`🎵 Received audio: ${data.byteLength} bytes`)
    audioPlaybackService.addAudioData(data)
  }

  /**
   * Handle Websocket error
   */
  function handleWebsocketError(error: Error): void {
    console.error('❌ Websocket error:', error)
    errorHandler.showErrorMessage('Websocket错误', error.message)
  }

  // ==== End Websocket Integration ====

  return {
    // 状态
    messages,
    isListening,
    listenMode,
    recognitionLang,
    voiceSettings,
    currentInput,
    isSpeaking,
    currentEmotion,
    currentTTSText,
    latestMessage,
    stats,
    connectionState,
    isConnected,

    // 基础方法
    loadHistory,
    saveHistory,
    addMessage,
    clearMessages,
    setInput,
    clearInput,
    updateVoiceSettings,
    setListening,
    setSpeaking,
    setEmotion,
    exportHistory,
    importHistory,

    // Websocket 方法
    connectWebsocket,
    disconnectWebsocket,
    startVoiceListen,
    stopVoiceListen
  }
})