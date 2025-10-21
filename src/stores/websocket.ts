/**
 * WebSocket Pinia Store for vue-native-websocket-vue3
 *
 * This store handles WebSocket connection lifecycle and message routing.
 * It integrates with vue-native-websocket-vue3 plugin through SOCKET_* actions.
 */

import { defineStore } from 'pinia'
import { store } from '@/stores'
import type {
  WebsocketMessage,
  HelloMessage,
  TTSMessage,
  LLMMessage,
  MCPMessage
} from '@/types/websocket-native'

interface WebSocketState {
  // 连接状态
  isConnected: boolean
  // 最后收到的消息
  lastMessage: WebsocketMessage | null
  // 重连错误标志
  reconnectError: boolean
  // 心跳间隔 (ms)
  heartBeatInterval: number
  // 心跳定时器
  heartBeatTimer: number
  // 连接质量
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown'
  // 延迟 (ms)
  latency: number
  // WebSocket 实例引用
  socket: WebSocket | null
}

export const useWebSocketStore = defineStore({
  id: 'websocket',

  state: (): WebSocketState => ({
    isConnected: false,
    lastMessage: null,
    reconnectError: false,
    heartBeatInterval: 30000, // 30 seconds
    heartBeatTimer: 0,
    connectionQuality: 'unknown',
    latency: 0,
    socket: null
  }),

  getters: {
    /**
     * Get connection state as string
     */
    connectionState(state): 'connected' | 'disconnected' | 'error' {
      if (state.reconnectError) return 'error'
      return state.isConnected ? 'connected' : 'disconnected'
    }
  },

  actions: {
    /**
     * SOCKET_ONOPEN - Called when WebSocket connection is established
     * This is automatically triggered by vue-native-websocket-vue3
     */
    SOCKET_ONOPEN(event: Event) {
      console.log('✅ WebSocket connected', event)

      const target = event.currentTarget as WebSocket
      this.socket = target
      this.isConnected = true
      this.reconnectError = false
      this.connectionQuality = 'unknown'

      // Send hello message after connection
      this.sendHello()

      // Start heartbeat
      this.startHeartbeat()
    },

    /**
     * SOCKET_ONCLOSE - Called when WebSocket connection is closed
     * This is automatically triggered by vue-native-websocket-vue3
     */
    SOCKET_ONCLOSE(event: CloseEvent) {
      console.log('🔌 WebSocket disconnected', event.code, event.reason)

      this.isConnected = false
      this.socket = null
      this.connectionQuality = 'unknown'

      // Stop heartbeat
      this.stopHeartbeat()
    },

    /**
     * SOCKET_ONERROR - Called when WebSocket error occurs
     * This is automatically triggered by vue-native-websocket-vue3
     */
    SOCKET_ONERROR(event: Event) {
      console.error('❌ WebSocket error', event)
      this.reconnectError = true
    },

    /**
     * SOCKET_ONMESSAGE - Called when WebSocket message is received
     * This is automatically triggered by vue-native-websocket-vue3
     */
    SOCKET_ONMESSAGE(message: MessageEvent) {
      try {
        // Parse JSON message
        const data = JSON.parse(message.data) as WebsocketMessage

        console.log('📨 WebSocket message received:', data.type)

        this.lastMessage = data

        // Route message to chat store based on type
        this.routeMessage(data)
      }
      catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    },

    /**
     * SOCKET_RECONNECT - Called when WebSocket reconnects
     * This is automatically triggered by vue-native-websocket-vue3
     */
    SOCKET_RECONNECT(count: number) {
      console.log('🔄 WebSocket reconnecting... attempt', count)
      this.reconnectError = false
    },

    /**
     * SOCKET_RECONNECT_ERROR - Called when WebSocket reconnection fails
     * This is automatically triggered by vue-native-websocket-vue3
     */
    SOCKET_RECONNECT_ERROR() {
      console.error('❌ WebSocket reconnection error')
      this.reconnectError = true
    },

    /**
     * Route message to appropriate handler
     */
    routeMessage(message: WebsocketMessage) {
      // Import chat store dynamically to avoid circular dependency
      import('@/stores/chat').then(({ useChatStore }) => {
        const chatStore = useChatStore()

        switch (message.type) {
          case 'hello':
            console.log('👋 Server hello:', message)
            break

          case 'tts':
            chatStore.handleTTSMessage(message as TTSMessage)
            break

          case 'llm':
            chatStore.handleLLMMessage(message as LLMMessage)
            break

          case 'mcp':
            chatStore.handleMCPMessage(message as MCPMessage)
            break

          case 'pong':
            this.handlePong((message as any).timestamp)
            break

          default:
            console.warn('Unknown message type:', message.type)
        }
      })
    },

    /**
     * Send message through WebSocket
     */
    send(message: WebsocketMessage) {
      if (!this.socket || !this.isConnected) {
        console.error('Cannot send message: WebSocket not connected')
        return
      }

      try {
        const data = JSON.stringify(message)
        this.socket.send(data)
        console.log('📤 Message sent:', message.type)
      }
      catch (error) {
        console.error('Failed to send message:', error)
      }
    },

    /**
     * Send binary audio data
     */
    sendBinary(data: ArrayBuffer) {
      if (!this.socket || !this.isConnected) {
        console.error('Cannot send audio: WebSocket not connected')
        return
      }

      try {
        this.socket.send(data)
      }
      catch (error) {
        console.error('Failed to send binary data:', error)
      }
    },

    /**
     * Send hello message
     */
    sendHello() {
      // Import config dynamically
      import('@/config/websocket').then(({ websocketConfig, audioRecordingConfig }) => {
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
      })
    },

    /**
     * Start heartbeat monitoring
     */
    startHeartbeat() {
      // Stop existing heartbeat
      this.stopHeartbeat()

      // Send ping every 30 seconds
      this.heartBeatTimer = window.setInterval(() => {
        if (this.isConnected) {
          const pingMessage = {
            type: 'ping',
            timestamp: Date.now()
          }
          this.send(pingMessage as any)

          // Update connection quality based on latency
          if (this.latency > 500) {
            this.connectionQuality = 'poor'
          }
          else if (this.latency > 200) {
            this.connectionQuality = 'good'
          }
          else if (this.latency > 0) {
            this.connectionQuality = 'excellent'
          }
        }
      }, this.heartBeatInterval)

      console.log('💓 Heartbeat started')
    },

    /**
     * Stop heartbeat monitoring
     */
    stopHeartbeat() {
      if (this.heartBeatTimer) {
        window.clearInterval(this.heartBeatTimer)
        this.heartBeatTimer = 0
        console.log('💔 Heartbeat stopped')
      }
    },

    /**
     * Handle pong response
     */
    handlePong(timestamp: number) {
      const now = Date.now()
      this.latency = now - timestamp
      console.log(`💓 Pong received (latency: ${this.latency}ms)`)
    }
  }
})

/**
 * Use WebSocket store outside of setup
 */
export function useWebSocketStoreWithOut() {
  return useWebSocketStore(store)
}
