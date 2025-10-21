import {io} from 'socket.io-client'
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
    SocketInstance
} from '@/types/websocket'
import {websocketConfig, audioRecordingConfig, audioPlaybackConfig, getAccessToken} from '@/config/websocket'
import {errorHandler} from '@/utils/errorHandler'

/**
 * Socket.IO Service for Voice Chat
 * Handles connection, authentication, and message exchange
 *
 * Enhanced with:
 * - Health check and heartbeat monitoring
 * - Connection quality tracking
 * - Comprehensive error recovery
 * - Event lifecycle management
 */
export class WebsocketService {
    private socket: SocketInstance | null = null
    private connectionState: ConnectionState = 'disconnected'
    private reconnectAttempts = 0
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
     * Connect to Socket.IO server
     */
    async connect(handlers: WebsocketEventHandlers = {}): Promise<void> {
        if (this.socket && this.connectionState === 'connected') {
            console.warn('Already connected to Socket.IO server')
            return
        }

        this.eventHandlers = handlers
        this.connectionState = 'connecting'

        try {
            const token = getAccessToken()

            if (!token) {
                throw new Error('Access token is required for authentication')
            }

            // Parse URL to get base server address and path
            const url = new URL(websocketConfig.url)
            const serverUrl = `${url.protocol}//${url.host}`
            const urlPath = url.pathname && url.pathname !== '/' ? url.pathname : undefined

            console.log('🔗 Connecting to Socket.IO server:', serverUrl)
            console.log('📝 URL path:', urlPath || '(using Socket.IO default)')
            console.log('📝 Authentication info:', {
                deviceId: websocketConfig.deviceId,
                clientId: websocketConfig.clientId,
                protocolVersion: websocketConfig.protocolVersion,
                authTokenLength: token.length
            })

            url.searchParams.set('Authorization', 'Bearer ' + token)
            url.searchParams.set('device_id', websocketConfig.deviceId)
            url.searchParams.set('client_id', websocketConfig.clientId)
            url.searchParams.set('protocol_version', websocketConfig.protocolVersion.toString())

            // Create Socket.IO connection with authentication
            // Use 'auth' for handshake data that server needs to identify the client
            const socketOptions: any = {
                transports: ['websocket'],
                auth: {
                    'Authorization': 'Bearer ' + token,
                    'Device-Id': websocketConfig.deviceId,
                    'Client-Id': websocketConfig.clientId,
                    'Protocol-Version': websocketConfig.protocolVersion
                },
                reconnection: websocketConfig.reconnect,
                reconnectionDelay: websocketConfig.reconnectInterval,
                reconnectionAttempts: websocketConfig.reconnectMaxAttempts,
                autoConnect: false
            }

            // Determine final path
            // Priority: explicit config.path > URL path > Socket.IO default
            let finalPath: string | undefined

            if (websocketConfig.path !== undefined) {
                // config.path is explicitly set (could be '', '/', or custom path)
                if (websocketConfig.path === '') {
                    // Empty string means use Socket.IO default
                    finalPath = undefined
                    console.log('📍 Using Socket.IO default path (/socket.io)')
                } else {
                    // Use the configured path
                    finalPath = websocketConfig.path
                    console.log('📍 Using configured path:', finalPath)
                }
            } else if (urlPath) {
                // Use path from URL
                finalPath = urlPath
                console.log('📍 Using URL path:', finalPath)
            } else {
                // No path specified, Socket.IO will use default
                finalPath = undefined
                console.log('📍 Using Socket.IO default path (/socket.io)')
            }

            // Set path option if we have a custom path
            if (finalPath !== undefined) {
                socketOptions.path = finalPath
            }

            console.log('🚀 Connecting to Socket.IO server...', socketOptions)
            this.socket = io(serverUrl, socketOptions)

            // Setup event listeners
            this.setupEventListeners()

            // Connect manually to have control over connection lifecycle
            this.socket.connect()

            // Wait for connection
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'))
                }, 10000)

                this.socket!.once('connect', () => {
                    clearTimeout(timeout)
                    resolve()
                })

                this.socket!.once('connect_error', (error) => {
                    clearTimeout(timeout)
                    reject(error)
                })
            })

            // Send hello message after connection
            await this.sendHello()

            this.connectionState = 'connected'
            this.reconnectAttempts = 0
            this.eventHandlers.onConnected?.()

            // Start heartbeat monitoring
            this.startHeartbeat()

            console.log('✅ Socket.IO connected successfully')
        } catch (error) {
            this.connectionState = 'error'
            this.handleError(error as Error)
            throw error
        }
    }

    /**
     * Disconnect from Socket.IO server
     */
    disconnect(): void {
        // Stop heartbeat monitoring
        this.stopHeartbeat()

        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }

        this.connectionState = 'disconnected'
        this.connectionQuality = 'unknown'
        this.eventHandlers.onDisconnected?.()
        console.log('🔌 Socket.IO disconnected')
    }

    /**
     * Setup Socket.IO event listeners
     */
    private setupEventListeners(): void {
        if (!this.socket) return

        // Connection events
        this.socket.on('connect', this.handleConnect.bind(this))
        this.socket.on('disconnect', this.handleDisconnect.bind(this))
        this.socket.on('connect_error', this.handleConnectionError.bind(this))

        // Custom message events
        this.socket.on('hello', (message: HelloMessage) => this.handleHelloResponse(message))
        this.socket.on('tts', (message: TTSMessage) => this.handleTTSMessage(message))
        this.socket.on('llm', (message: LLMMessage) => this.handleLLMMessage(message))
        this.socket.on('mcp', (message: MCPMessage) => this.handleMCPMessage(message))
        this.socket.on('audio', (data: ArrayBuffer) => this.handleAudioData(data))

        // Health check events
        this.socket.on('pong', () => this.handlePong())

        // Reconnection events
        this.socket.on('reconnect_attempt', (attemptNumber: number) => {
            this.reconnectAttempts = attemptNumber
            this.connectionState = 'reconnecting'
            console.log(`🔄 Reconnecting... (attempt ${attemptNumber}/${websocketConfig.reconnectMaxAttempts})`)
        })

        this.socket.on('reconnect', () => {
            this.reconnectAttempts = 0
            this.connectionState = 'connected'
            console.log('✅ Reconnected successfully')
            this.eventHandlers.onConnected?.()
            this.startHeartbeat() // Restart heartbeat after reconnection
        })

        this.socket.on('reconnect_failed', () => {
            console.error('❌ Reconnection failed')
            this.connectionState = 'error'
            this.handleError(new Error('Reconnection failed'))
        })
    }

    /**
     * Handle Socket.IO connect event
     */
    private handleConnect(): void {
        console.log('🔗 Socket.IO connection established')
    }

    /**
     * Handle Socket.IO disconnect event
     */
    private handleDisconnect(reason: string): void {
        console.log('🔌 Socket.IO disconnected:', reason)
        this.connectionState = 'disconnected'
        this.eventHandlers.onDisconnected?.()
    }

    /**
     * Handle Socket.IO connection error
     */
    private handleConnectionError(error: Error): void {
        console.error('❌ Socket.IO connection error:', error)
        this.connectionState = 'error'
        this.handleError(error)
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
            transport: 'socketio',
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

        this.emit('hello', helloMessage)
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

        this.emit('listen', message)
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

        this.emit('listen', message)
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

        this.emit('listen', message)
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

        this.emit('abort', message)
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

        this.emit('mcp', message)
    }

    /**
     * Emit event through Socket.IO
     */
    private emit(event: string, data: WebsocketMessage | ArrayBuffer): void {
        if (!this.socket || this.connectionState !== 'connected') {
            console.error('Cannot emit event: not connected')
            return
        }

        try {
            this.socket.emit(event, data)
            this.sessionInfo.messageCount++
        } catch (error) {
            console.error('Failed to emit event:', error)
            this.handleError(error as Error)
        }
    }

    /**
     * Send binary audio data
     */
    sendAudioData(data: ArrayBuffer): void {
        if (!this.socket || this.connectionState !== 'connected') {
            console.error('Cannot send audio: not connected')
            return
        }

        try {
            this.socket.emit('audio', data)
            this.sessionInfo.audioBytesSent += data.byteLength
        } catch (error) {
            console.error('Failed to send audio data:', error)
            this.handleError(error as Error)
        }
    }

    /**
     * Handle errors
     */
    private handleError(error: Error): void {
        console.error('Socket.IO service error:', error)
        errorHandler.showErrorMessage('Socket.IO连接错误', error.message)
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
        return this.connectionState === 'connected' && this.socket?.connected === true
    }

    /**
     * Get session info
     */
    getSessionInfo(): SessionInfo {
        return {...this.sessionInfo}
    }

    /**
     * Start heartbeat monitoring
     */
    private startHeartbeat(): void {
        // Stop existing heartbeat
        this.stopHeartbeat()

        // Send ping every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.connectionState === 'connected') {
                const pingTime = Date.now()
                this.socket.emit('ping', { timestamp: pingTime })

                // Check if pong was received recently (within 10 seconds)
                const timeSinceLastPong = Date.now() - this.lastPongTime
                if (timeSinceLastPong > 10000) {
                    console.warn('⚠️ Heartbeat timeout, connection may be unstable')
                    this.connectionQuality = 'poor'
                } else if (this.latency > 500) {
                    this.connectionQuality = 'poor'
                } else if (this.latency > 200) {
                    this.connectionQuality = 'good'
                } else {
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
    private handlePong(): void {
        const now = Date.now()
        this.latency = now - this.lastPongTime
        this.lastPongTime = now
        console.log(`💓 Pong received (latency: ${this.latency}ms)`)
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
        if (this.socket) {
            this.socket.disconnect()
            this.socket.connect()
        }
    }
}

// Create singleton instance
export const websocketService = new WebsocketService()
