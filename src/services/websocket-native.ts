import type {
  WebsocketMessage,
  HelloMessage,
  ListenMessage,
  TTSMessage,
  AbortMessage,
  MCPMessage,
  LLMMessage,
  PingMessage,
  ConnectionState,
  WebsocketEventHandlers,
  ListenMode,
  SessionInfo,
  SocketInstance
} from '@/types/websocket-native'
import { websocketConfig, audioRecordingConfig, getAccessToken } from '@/config/websocket'
import { errorHandler } from '@/utils/errorHandler'

/**
 * Native WebSocket Service for Voice Chat
 *
 * IMPORTANT MIGRATION NOTES:
 * ================================
 * This service uses NATIVE WebSocket instead of Socket.IO.
 *
 * Key Differences:
 * 1. No automatic reconnection (implemented manually)
 * 2. No named events (using message routing)
 * 3. No built-in authentication (passed in URL/headers)
 * 4. Binary data handling requires special care
 *
 * Server Requirements:
 * ================================
 * Your server MUST be updated to support this protocol:
 *
 * 1. Accept native WebSocket connections (not Socket.IO)
 * 2. Parse message.type and route to appropriate handlers
 * 3. Send messages with {type: 'xxx', ...} format
 * 4. Handle binary audio data separately
 * 5. Implement pong response for ping messages
 *
 * Example Server Code (Node.js):
 * ```javascript
 * const WebSocket = require('ws')
 * const wss = new WebSocket.Server({ port: 8080 })
 *
 * wss.on('connection', (ws) => {
 *   ws.on('message', (data) => {
 *     if (typeof data === 'string') {
 *       const message = JSON.parse(data)
 *       switch (message.type) {
 *         case 'hello':
 *           ws.send(JSON.stringify({ type: 'hello', ... }))
 *           break
 *         case 'listen':
 *           // Handle listen
 *           break
 *         case 'ping':
 *           ws.send(JSON.stringify({ type: 'pong', timestamp: message.timestamp }))
 *           break
 *       }
 *     } else {
 *       // Binary audio data
 *       processAudioData(data)
 *     }
 *   })
 * })
 * ```
 */
export class WebsocketService {
  private socket: SocketInstance | null = null
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

  // Health check and monitoring
  private heartbeatInterval: number | null = null
  private lastPongTime: number = Date.now()
  private connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown' = 'unknown'
  private latency: number = 0

  /**
   * Connect to WebSocket server
   */
  async connect(handlers: WebsocketEventHandlers = {}): Promise<void> {
    if (this.socket && this.connectionState === 'connected') {
      console.warn('Already connected to WebSocket server')
      return
    }

    this.eventHandlers = handlers
    this.connectionState = 'connecting'

    try {
      const token = getAccessToken()

      if (!token) {
        throw new Error('Access token is required for authentication')
      }

      // Build WebSocket URL with authentication parameters
      const url = new URL(websocketConfig.url)

      // Change protocol to WebSocket (ws/wss)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

      // Add authentication as query parameters
      url.searchParams.set('Authorization', `Bearer ${token}`)
      url.searchParams.set('device_id', websocketConfig.deviceId)
      url.searchParams.set('client_id', websocketConfig.clientId)
      url.searchParams.set('protocol_version', websocketConfig.protocolVersion.toString())

      console.log('🔗 Connecting to native WebSocket server:', url.origin)
      console.log('📝 Authentication info:', {
        deviceId: websocketConfig.deviceId,
        clientId: websocketConfig.clientId,
        protocolVersion: websocketConfig.protocolVersion,
        authTokenLength: token.length
      })

      // Create native WebSocket connection
      this.socket = new WebSocket(url.toString())
      this.socket.binaryType = 'arraybuffer' // Important for audio data

      // Setup event listeners
      this.setupEventListeners()

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        const onOpen = () => {
          clearTimeout(timeout)
          this.socket!.removeEventListener('open', onOpen)
          this.socket!.removeEventListener('error', onError)
          resolve()
        }

        const onError = (error: Event) => {
          clearTimeout(timeout)
          this.socket!.removeEventListener('open', onOpen)
          this.socket!.removeEventListener('error', onError)
          reject(error)
        }

        this.socket!.addEventListener('open', onOpen)
        this.socket!.addEventListener('error', onError)
      })

      // Send hello message after connection
      await this.sendHello()

      this.connectionState = 'connected'
      this.reconnectAttempts = 0
      this.eventHandlers.onConnected?.()

      // Start heartbeat monitoring
      this.startHeartbeat()

      console.log('✅ Native WebSocket connected successfully')
    }
    catch (error) {
      this.connectionState = 'error'
      this.handleError(error instanceof Error ? error : new Error('Connection failed'))
      throw error
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    // Stop heartbeat and reconnection
    this.stopHeartbeat()
    this.stopReconnection()

    if (this.socket) {
      // Remove event listeners before closing
      this.socket.onopen = null
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.onmessage = null

      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close(1000, 'Client disconnect')
      }

      this.socket = null
    }

    this.connectionState = 'disconnected'
    this.connectionQuality = 'unknown'
    this.eventHandlers.onDisconnected?.()
    console.log('🔌 Native WebSocket disconnected')
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.onopen = this.handleOpen.bind(this)
    this.socket.onclose = this.handleClose.bind(this)
    this.socket.onerror = this.handleError.bind(this)
    this.socket.onmessage = this.handleMessage.bind(this)
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    console.log('🔗 Native WebSocket connection established')
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('🔌 Native WebSocket disconnected:', event.code, event.reason)
    this.connectionState = 'disconnected'
    this.stopHeartbeat()
    this.eventHandlers.onDisconnected?.()

    // Attempt reconnection if enabled
    if (websocketConfig.reconnect && event.code !== 1000) {
      this.attemptReconnection()
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Event | Error): void {
    const errorMessage = error instanceof Error ? error.message : 'WebSocket error'
    console.error('❌ Native WebSocket error:', errorMessage)

    this.connectionState = 'error'
    errorHandler.showErrorMessage('WebSocket连接错误', errorMessage)

    if (error instanceof Error) {
      this.eventHandlers.onError?.(error)
    }
    else {
      this.eventHandlers.onError?.(new Error('WebSocket error'))
    }
  }

  /**
   * Handle WebSocket message
   * This is the core message router for native WebSocket
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Binary data (audio)
      if (event.data instanceof ArrayBuffer) {
        this.handleAudioData(event.data)
        return
      }

      // Text data (JSON messages)
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data) as WebsocketMessage

        // Route message based on type
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
          case 'pong':
            this.handlePong(message as { timestamp: number })
            break
          default:
            console.warn('Unknown message type:', message.type, message)
        }
      }
    }
    catch (error) {
      console.error('Failed to handle WebSocket message:', error, event.data)
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
    this.sessionInfo.messageCount++
    this.eventHandlers.onTTS?.(message)
  }

  /**
   * Handle LLM emotion message from server
   */
  private handleLLMMessage(message: LLMMessage): void {
    console.log('😊 LLM emotion:', message.emotion)
    this.sessionInfo.messageCount++
    this.eventHandlers.onLLM?.(message)
  }

  /**
   * Handle MCP message from server
   */
  private handleMCPMessage(message: MCPMessage): void {
    console.log('📦 MCP message:', message.payload)
    this.sessionInfo.messageCount++
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

    this.send(helloMessage)
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
      state: 'stop'
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
      text: wakeWord
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
      reason
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
      payload
    }

    this.send(message)
  }

  /**
   * Send message through native WebSocket
   */
  private send(message: WebsocketMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: not connected')
      return
    }

    try {
      const data = JSON.stringify(message)
      this.socket.send(data)
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
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send audio: not connected')
      return
    }

    try {
      this.socket.send(data)
      this.sessionInfo.audioBytesSent += data.byteLength
    }
    catch (error) {
      console.error('Failed to send audio data:', error)
      this.handleError(error as Error)
    }
  }

  /**
   * Attempt reconnection
   */
  private attemptReconnection(): void {
    if (this.reconnectAttempts >= websocketConfig.reconnectMaxAttempts) {
      console.error('❌ Max reconnection attempts reached')
      this.connectionState = 'error'
      this.handleError(new Error('Reconnection failed'))
      return
    }

    this.reconnectAttempts++
    this.connectionState = 'reconnecting'

    console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${websocketConfig.reconnectMaxAttempts})`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect(this.eventHandlers).catch((error) => {
        console.error('Reconnection attempt failed:', error)
        this.attemptReconnection()
      })
    }, websocketConfig.reconnectInterval)
  }

  /**
   * Stop reconnection attempts
   */
  private stopReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const pingMessage: PingMessage = {
          type: 'ping',
          timestamp: Date.now()
        }
        this.send(pingMessage)

        // Check connection quality
        const timeSinceLastPong = Date.now() - this.lastPongTime
        if (timeSinceLastPong > 10000) {
          console.warn('⚠️ Heartbeat timeout, connection may be unstable')
          this.connectionQuality = 'poor'
        }
        else if (this.latency > 500) {
          this.connectionQuality = 'poor'
        }
        else if (this.latency > 200) {
          this.connectionQuality = 'good'
        }
        else {
          this.connectionQuality = 'excellent'
        }
      }
    }, 30000)

    console.log('💓 Heartbeat monitoring started')
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      console.log('💔 Heartbeat monitoring stopped')
    }
  }

  /**
   * Handle pong response
   */
  private handlePong(message: { timestamp: number }): void {
    const now = Date.now()
    this.latency = now - message.timestamp
    this.lastPongTime = now
    console.log(`💓 Pong received (latency: ${this.latency}ms)`)
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
    return this.connectionState === 'connected' && this.socket?.readyState === WebSocket.OPEN
  }

  /**
   * Get session info
   */
  getSessionInfo(): SessionInfo {
    return { ...this.sessionInfo }
  }

  /**
   * Get connection quality
   */
  getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'unknown' {
    return this.connectionQuality
  }

  /**
   * Get current latency
   */
  getLatency(): number {
    return this.latency
  }

  /**
   * Force reconnect
   */
  reconnect(): void {
    console.log('🔄 Force reconnecting...')
    this.disconnect()
    setTimeout(() => {
      this.connect(this.eventHandlers).catch(error => {
        console.error('Force reconnect failed:', error)
      })
    }, 1000)
  }
}

// Create singleton instance
export const websocketService = new WebsocketService()
