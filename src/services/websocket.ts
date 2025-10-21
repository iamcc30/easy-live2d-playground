import { ref } from 'vue'
import type {
  WebsocketMessage,
  HelloMessage,
  ListenMessage,
  TTSMessage,
  AbortMessage,
  MCPMessage,
  LLMMessage,
  ConnectionState,
  WebsocketEventHandlers,
  ListenMode,
  SessionInfo,
} from '@/types/websocket'
import { websocketConfig, audioRecordingConfig, getAccessToken } from '@/config/websocket'
import { errorHandler } from '@/utils/errorHandler'

/**
 * Native WebSocket Service for Voice Chat
 * Handles connection, authentication, and message exchange using native WebSocket API
 */
export class WebsocketService {
  private ws: WebSocket | null = null
  // Use Vue ref for reactive connection state
  private connectionState = ref<ConnectionState>('disconnected')
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private eventHandlers: WebsocketEventHandlers = {}
  private sessionInfo: SessionInfo = {
    sessionId: '',
    startTime: new Date(),
    messageCount: 0,
    audioBytesSent: 0,
    audioBytesReceived: 0,
  }

  /**
   * Connect to WebSocket server
   */
  async connect(handlers: WebsocketEventHandlers = {}): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('Already connected to WebSocket server')
      return
    }

    this.eventHandlers = handlers
    this.connectionState.value = 'connecting'

    try {
      const token = getAccessToken()

      // if (!token || token === 'xxxx') {
      //   throw new Error('Valid access token is required for authentication')
      // }

      // Convert HTTP URL to WebSocket URL
      const wsUrl = websocketConfig.url.replace(/^http/, 'ws')

      // Build WebSocket URL with query parameters for authentication
      const url = new URL(wsUrl)
      url.searchParams.set('token', token)
      url.searchParams.set('deviceId', websocketConfig.deviceId)
      url.searchParams.set('clientId', websocketConfig.clientId)
      url.searchParams.set('protocolVersion', websocketConfig.protocolVersion.toString())

      console.log('🔗 Connecting to WebSocket server:', wsUrl)
      console.log('📝 Authentication info:', {
        deviceId: websocketConfig.deviceId,
        clientId: websocketConfig.clientId,
        protocolVersion: websocketConfig.protocolVersion,
        authTokenLength: token.length,
      })

      // Create WebSocket connection
      this.ws = new WebSocket(url.toString())
      this.ws.binaryType = 'arraybuffer'

      // Setup event listeners
      this.setupEventListeners()

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        const onOpen = () => {
          clearTimeout(timeout)
          this.ws?.removeEventListener('open', onOpen)
          this.ws?.removeEventListener('error', onError)
          resolve()
        }

        const onError = () => {
          clearTimeout(timeout)
          this.ws?.removeEventListener('open', onOpen)
          this.ws?.removeEventListener('error', onError)
          reject(new Error('Connection failed'))
        }

        this.ws?.addEventListener('open', onOpen)
        this.ws?.addEventListener('error', onError)
      })

      // Send hello message after connection
      await this.sendHello()

      this.connectionState.value = 'connected'
      this.reconnectAttempts = 0
      this.eventHandlers.onConnected?.()

      console.log('✅ WebSocket connected successfully')
    }
    catch (error) {
      this.connectionState.value = 'error'
      this.handleError(error as Error)
      throw error
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnected')
      this.ws = null
    }

    this.connectionState.value = 'disconnected'
    this.eventHandlers.onDisconnected?.()
    console.log('🔌 WebSocket disconnected')
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.ws)
      return

    this.ws.onopen = this.handleOpen.bind(this)
    this.ws.onmessage = this.handleMessage.bind(this)
    this.ws.onerror = this.handleErrorEvent.bind(this)
    this.ws.onclose = this.handleClose.bind(this)
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('🔗 WebSocket connection established')
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      // Binary audio data
      this.handleAudioData(event.data)
    }
    else if (typeof event.data === 'string') {
      // JSON message
      try {
        const message = JSON.parse(event.data)
        this.handleJsonMessage(message)
      }
      catch (e) {
        console.error('Failed to parse message:', e)
      }
    }
  }

  /**
   * Handle JSON messages from server
   */
  private handleJsonMessage(message: any): void {
    this.sessionInfo.messageCount++

    console.log('📨 Received JSON message:', JSON.stringify(message, null, 2))

    switch (message.type) {
      case 'hello':
        this.handleHelloResponse(message as HelloMessage)
        break
      case 'tts':
        this.handleTTSMessage(message as TTSMessage)
        break
      case 'llm':
        this.handleLLMMessage(message as LLMMessage)
        break
      case 'mcp':
        this.handleMCPMessage(message as MCPMessage)
        break
      case 'listen':
        // Handle listen response if needed
        console.log('🎤 Listen response:', message)
        break
      default:
        console.warn('Unknown message type:', message.type)
    }
  }

  /**
   * Handle hello response from server
   */
  private handleHelloResponse(message: HelloMessage): void {
    console.log('👋 Server hello response:', message)

    // Handle session_id according to protocol
    // Protocol: "Websocket 协议不返回 session_id，会话 ID 可设为空"
    if (message.session_id) {
      // Server returned session_id (not standard, but supported)
      this.sessionInfo.sessionId = message.session_id
      console.log('📝 Server-assigned session ID:', message.session_id)
    } else {
      // Protocol standard: server doesn't return session_id
      // Use client-generated session_id (already set in sendHello)
      console.log('ℹ️ Using client-generated session ID:', this.sessionInfo.sessionId)
    }

    this.eventHandlers.onHello?.(message)
  }

  /**
   * Handle TTS message from server
   */
  private handleTTSMessage(message: TTSMessage): void {
    console.log('🔊 TTS message:', message.state, message.text)
    this.eventHandlers.onTTS?.(message)
  }

  /**
   * Handle LLM emotion message from server
   */
  private handleLLMMessage(message: LLMMessage): void {
    console.log('😊 LLM emotion:', message.emotion)
    this.eventHandlers.onLLM?.(message)
  }

  /**
   * Handle MCP message from server
   */
  private handleMCPMessage(message: MCPMessage): void {
    console.log('📦 MCP message:', message.payload)
    this.eventHandlers.onMCP?.(message)
  }

  /**
   * Handle binary audio data from server
   */
  private handleAudioData(data: ArrayBuffer): void {
    this.sessionInfo.audioBytesReceived += data.byteLength
    console.log(`🎵 Received audio data: ${data.byteLength} bytes`)
    this.eventHandlers.onAudioData?.(data)
  }

  /**
   * Handle WebSocket error event
   */
  private handleErrorEvent(event: Event): void {
    console.error('❌ WebSocket error:', event)
    this.connectionState.value = 'error'
    this.handleError(new Error('WebSocket error'))
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('🔌 WebSocket closed:', event.code, event.reason)
    this.connectionState.value = 'disconnected'
    this.eventHandlers.onDisconnected?.()

    // Auto reconnect if not manually closed
    if (event.code !== 1000 && websocketConfig.reconnect) {
      this.scheduleReconnect()
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= websocketConfig.reconnectMaxAttempts) {
      console.error('❌ Max reconnection attempts reached')
      this.connectionState.value = 'error'
      this.handleError(new Error('Max reconnection attempts reached'))
      return
    }

    this.reconnectAttempts++
    this.connectionState.value = 'reconnecting'

    const delay = websocketConfig.reconnectInterval * this.reconnectAttempts
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${websocketConfig.reconnectMaxAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.eventHandlers).catch((error) => {
        console.error('Reconnection failed:', error)
        this.scheduleReconnect()
      })
    }, delay)
  }

  /**
   * Send hello message to server
   */
  private async sendHello(): Promise<void> {
    // Generate client-side session_id immediately
    // Format: {deviceId}-{timestamp}-{random}
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 11)
    this.sessionInfo.sessionId = `${websocketConfig.deviceId}-${timestamp}-${random}`

    console.log('🆔 Generated client-side session_id:', this.sessionInfo.sessionId)

    const helloMessage: HelloMessage = {
      type: 'hello',
      version: websocketConfig.protocolVersion,
      transport: 'websocket',
      features: {
        mcp: true,
      },
      audio_params: {
        format: audioRecordingConfig.format,
        sample_rate: audioRecordingConfig.sampleRate,
        channels: audioRecordingConfig.channels,
        frame_duration: audioRecordingConfig.frameDuration,
      },
    }

    this.send(helloMessage)
    console.log('📤 Sent hello message with client session_id')
  }

  /**
   * Start listening (voice recognition)
   */
  startListen(mode: ListenMode = 'auto'): void {
    console.log('🎤 startListen called with mode:', mode)
    console.log('📝 Current sessionId:', this.sessionInfo.sessionId)
    console.log('📋 Full sessionInfo:', JSON.stringify(this.sessionInfo, null, 2))

    const message: ListenMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'listen',
      state: 'start',
      mode,
    }

    console.log('📤 Sending listen message:', JSON.stringify(message, null, 2))
    this.send(message)
    console.log(`🎤 Started listening in ${mode} mode`)
  }

  /**
   * Stop listening
   */
  stopListen(): void {
    const message: ListenMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'listen',
      state: 'stop',
    }

    this.send(message)
    console.log('🛑 Stopped listening')
  }

  /**
   * Send wake word detection
   */
  detectWakeWord(wakeWord: string): void {
    const message: ListenMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'listen',
      state: 'detect',
      text: wakeWord,
    }

    this.send(message)
    console.log('👂 Wake word detected:', wakeWord)
  }

  /**
   * Abort current session
   */
  abort(reason?: string): void {
    const message: AbortMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'abort',
      reason,
    }

    this.send(message)
    console.log('❌ Session aborted:', reason)
  }

  /**
   * Send MCP message
   */
  sendMCP(payload: unknown): void {
    const message: MCPMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'mcp',
      payload,
    }

    this.send(message)
  }

  /**
   * Send JSON message
   */
  private send(message: WebsocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: not connected')
      return
    }

    try {
      this.ws.send(JSON.stringify(message))
      this.sessionInfo.messageCount++
    }
    catch (error) {
      console.error('Failed to send message:', error)
      this.handleError(error as Error)
    }
  }

  /**
   * Send binary audio data
   */
  sendAudioData(data: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot send audio: not connected, readyState:', this.ws?.readyState)
      return
    }

    try {
      this.ws.send(data)
      this.sessionInfo.audioBytesSent += data.byteLength
      console.log(`📤 Sent audio data: ${data.byteLength} bytes (total: ${this.sessionInfo.audioBytesSent} bytes)`)
    }
    catch (error) {
      console.error('❌ Failed to send audio data:', error)
      this.handleError(error as Error)
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('WebSocket service error:', error)
    errorHandler.showErrorMessage('WebSocket连接错误', error.message)
    this.eventHandlers.onError?.(error)
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState.value
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState.value === 'connected' && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Get session info
   */
  getSessionInfo(): SessionInfo {
    return { ...this.sessionInfo }
  }
}

// Create singleton instance
export const websocketService = new WebsocketService()
