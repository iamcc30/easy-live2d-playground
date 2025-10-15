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
  SessionInfo
} from '@/types/websocket'
import { websocketConfig, audioRecordingConfig, audioPlaybackConfig, getAccessToken } from '@/config/websocket'
import { errorHandler } from '@/utils/errorHandler'

/**
 * Websocket Service for Voice Chat
 * Handles connection, authentication, and message exchange
 */
export class WebsocketService {
  private ws: WebSocket | null = null
  private connectionState: ConnectionState = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimer: number | null = null
  private eventHandlers: WebsocketEventHandlers = {}
  private sessionInfo: SessionInfo = {
    sessionId: '',
    startTime: new Date(),
    messageCount: 0,
    audioBytesSent: 0,
    audioBytesReceived: 0
  }

  /**
   * Connect to Websocket server
   */
  async connect(handlers: WebsocketEventHandlers = {}): Promise<void> {
    if (this.ws && this.connectionState === 'connected') {
      console.warn('Already connected to Websocket server')
      return
    }

    this.eventHandlers = handlers
    this.connectionState = 'connecting'

    try {
      const token = getAccessToken()

      if (!token) {
        throw new Error('Access token is required for authentication')
      }

      // Create WebSocket URL
      const url = new URL(websocketConfig.url)

      // Encode authentication info as WebSocket subprotocols
      // Server will receive these in Sec-WebSocket-Protocol header
      // Format: auth.<base64_token>, protocol-version.<version>, device-id.<id>, client-id.<id>
      const authProtocol = `auth.${btoa(token).replace(/=/g, '')}`
      const versionProtocol = `protocol-version.${websocketConfig.protocolVersion}`
      const deviceProtocol = `device-id.${websocketConfig.deviceId.replace(/:/g, '-')}`
      const clientProtocol = `client-id.${websocketConfig.clientId}`

      const protocols = [
        authProtocol,
        versionProtocol,
        deviceProtocol,
        clientProtocol
      ]

      console.log('🔗 Connecting to:', url.toString())
      console.log('📝 Authentication via subprotocols:', {
        deviceId: websocketConfig.deviceId,
        clientId: websocketConfig.clientId,
        protocolVersion: websocketConfig.protocolVersion,
        authTokenLength: token.length
      })

      // Create WebSocket with subprotocols
      // Server will receive these in Sec-WebSocket-Protocol header
      this.ws = new WebSocket(url.toString(), protocols)

      // Setup event listeners
      this.setupEventListeners()

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        this.ws!.addEventListener('open', () => {
          clearTimeout(timeout)
          console.log('🔗 Websocket opened, accepted protocol:', this.ws?.protocol)
          resolve()
        }, { once: true })

        this.ws!.addEventListener('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        }, { once: true })
      })

      // Send hello message after connection
      await this.sendHello()

      this.connectionState = 'connected'
      this.reconnectAttempts = 0
      this.eventHandlers.onConnected?.()

      console.log('✅ Websocket connected successfully')
    }
    catch (error) {
      this.connectionState = 'error'
      this.handleError(error as Error)
      throw error
    }
  }

  /**
   * Disconnect from Websocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.connectionState = 'disconnected'
    this.eventHandlers.onDisconnected?.()
    console.log('🔌 Websocket disconnected')
  }

  /**
   * Setup Websocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.ws) return

    this.ws.addEventListener('open', this.handleOpen.bind(this))
    this.ws.addEventListener('close', this.handleClose.bind(this))
    this.ws.addEventListener('error', this.handleWebsocketError.bind(this))
    this.ws.addEventListener('message', this.handleMessage.bind(this))
  }

  /**
   * Handle Websocket open event
   */
  private handleOpen(): void {
    console.log('🔗 Websocket connection opened')
  }

  /**
   * Handle Websocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('🔌 Websocket connection closed:', event.code, event.reason)
    this.connectionState = 'disconnected'

    // Attempt reconnection if enabled
    if (websocketConfig.reconnect && this.reconnectAttempts < websocketConfig.reconnectMaxAttempts) {
      this.attemptReconnect()
    }
    else {
      this.eventHandlers.onDisconnected?.()
    }
  }

  /**
   * Handle Websocket error event
   */
  private handleWebsocketError(event: Event): void {
    console.error('❌ Websocket error:', event)
    this.connectionState = 'error'
    this.handleError(new Error('Websocket connection error'))
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    this.sessionInfo.messageCount++

    // Handle binary data (audio)
    if (event.data instanceof ArrayBuffer) {
      this.handleAudioData(event.data)
      return
    }

    // Handle JSON messages
    try {
      const message = JSON.parse(event.data) as WebsocketMessage
      this.routeMessage(message)
    }
    catch (error) {
      console.error('Failed to parse message:', error)
    }
  }

  /**
   * Route message to appropriate handler
   */
  private routeMessage(message: WebsocketMessage): void {
    console.log('📨 Received message:', message.type)

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
      default:
        console.warn('Unknown message type:', (message as any).type)
    }
  }

  /**
   * Handle hello response from server
   */
  private handleHelloResponse(message: HelloMessage): void {
    console.log('👋 Server hello response:', message)
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
   * Send hello message to server
   */
  private async sendHello(): Promise<void> {
    const helloMessage: HelloMessage = {
      type: 'hello',
      version: websocketConfig.protocolVersion,
      transport: 'websocket',
      features: {
        mcp: true
      },
      audio_params: {
        format: audioRecordingConfig.format,
        sample_rate: audioRecordingConfig.sampleRate,
        channels: audioRecordingConfig.channels,
        frame_duration: audioRecordingConfig.frameDuration
      }
    }

    this.sendMessage(helloMessage)
  }

  /**
   * Start listening (voice recognition)
   */
  startListen(mode: ListenMode = 'auto'): void {
    const message: ListenMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'listen',
      state: 'start',
      mode
    }

    this.sendMessage(message)
    console.log(`🎤 Started listening in ${mode} mode`)
  }

  /**
   * Stop listening
   */
  stopListen(): void {
    const message: ListenMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'listen',
      state: 'stop'
    }

    this.sendMessage(message)
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
      text: wakeWord
    }

    this.sendMessage(message)
    console.log('👂 Wake word detected:', wakeWord)
  }

  /**
   * Abort current session
   */
  abort(reason?: string): void {
    const message: AbortMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'abort',
      reason
    }

    this.sendMessage(message)
    console.log('❌ Session aborted:', reason)
  }

  /**
   * Send MCP message
   */
  sendMCP(payload: unknown): void {
    const message: MCPMessage = {
      session_id: this.sessionInfo.sessionId,
      type: 'mcp',
      payload
    }

    this.sendMessage(message)
  }

  /**
   * Send JSON message
   */
  private sendMessage(message: WebsocketMessage): void {
    if (!this.ws || this.connectionState !== 'connected') {
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
    if (!this.ws || this.connectionState !== 'connected') {
      console.error('Cannot send audio: not connected')
      return
    }

    try {
      this.ws.send(data)
      this.sessionInfo.audioBytesSent += data.byteLength
    }
    catch (error) {
      console.error('Failed to send audio data:', error)
      this.handleError(error as Error)
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectAttempts++
    this.connectionState = 'reconnecting'

    console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${websocketConfig.reconnectMaxAttempts})`)

    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.connect(this.eventHandlers)
      }
      catch (error) {
        console.error('Reconnection failed:', error)
      }
    }, websocketConfig.reconnectInterval)
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('Websocket service error:', error)
    errorHandler.showErrorMessage('Websocket连接错误', error.message)
    this.eventHandlers.onError?.(error)
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected'
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
