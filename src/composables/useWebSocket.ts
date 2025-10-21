/**
 * WebSocket Composable
 *
 * Inspired by vue-native-websocket-vue3 design patterns
 * Provides Vue 3 Composition API for Socket.IO operations
 */

import { ref, computed, onUnmounted, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import type { ConnectionState, ListenMode } from '@/types/websocket'

/**
 * WebSocket connection composable
 *
 * @example
 * ```ts
 * const {
 *   isConnected,
 *   connectionState,
 *   connect,
 *   disconnect,
 *   sendMessage
 * } = useWebSocket({ autoConnect: true })
 * ```
 */
export function useWebSocket(options: {
  autoConnect?: boolean
  autoDisconnect?: boolean
} = {}) {
  const chatStore = useChatStore()

  // Reactive state from store
  const connectionState = computed<ConnectionState>(() => chatStore.connectionState)
  const isConnected = computed<boolean>(() => chatStore.isConnected)
  const isReconnecting = computed<boolean>(() => connectionState.value === 'reconnecting')
  const hasError = computed<boolean>(() => connectionState.value === 'error')

  // Local state
  const isConnecting = ref(false)
  const lastError = ref<Error | null>(null)

  /**
   * Connect to WebSocket server
   */
  const connect = async (): Promise<void> => {
    if (isConnected.value || isConnecting.value) {
      console.warn('[useWebSocket] Already connected or connecting')
      return
    }

    isConnecting.value = true
    lastError.value = null

    try {
      await chatStore.connectWebsocket()
      console.log('[useWebSocket] ✅ Connected successfully')
    }
    catch (error) {
      lastError.value = error instanceof Error ? error : new Error('Unknown error')
      console.error('[useWebSocket] ❌ Connection failed:', error)
      throw error
    }
    finally {
      isConnecting.value = false
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = (): void => {
    if (!isConnected.value) {
      console.warn('[useWebSocket] Not connected')
      return
    }

    chatStore.disconnectWebsocket()
    console.log('[useWebSocket] 🔌 Disconnected')
  }

  /**
   * Send text message to server
   */
  const sendMessage = (text: string): void => {
    if (!isConnected.value) {
      console.error('[useWebSocket] Cannot send message: not connected')
      return
    }

    chatStore.addMessage(text, true)
    console.log('[useWebSocket] 📤 Message sent:', text)
  }

  /**
   * Start voice listening
   */
  const startListening = async (mode: ListenMode = 'auto'): Promise<void> => {
    if (!isConnected.value) {
      throw new Error('Cannot start listening: not connected')
    }

    await chatStore.startVoiceListen(mode)
    console.log('[useWebSocket] 🎤 Started listening')
  }

  /**
   * Stop voice listening
   */
  const stopListening = (): void => {
    chatStore.stopVoiceListen()
    console.log('[useWebSocket] 🛑 Stopped listening')
  }

  /**
   * Retry connection
   */
  const retry = async (): Promise<void> => {
    console.log('[useWebSocket] 🔄 Retrying connection...')
    disconnect()
    await new Promise(resolve => setTimeout(resolve, 1000))
    await connect()
  }

  // Auto-connect on mount
  if (options.autoConnect) {
    connect().catch(err => {
      console.error('[useWebSocket] Auto-connect failed:', err)
    })
  }

  // Auto-disconnect on unmount
  if (options.autoDisconnect) {
    onUnmounted(() => {
      if (isConnected.value) {
        disconnect()
      }
    })
  }

  return {
    // State
    connectionState,
    isConnected,
    isConnecting,
    isReconnecting,
    hasError,
    lastError,

    // Methods
    connect,
    disconnect,
    sendMessage,
    startListening,
    stopListening,
    retry,

    // Store access (for advanced usage)
    store: chatStore
  }
}

/**
 * WebSocket messages composable
 * Provides reactive access to chat messages
 *
 * @example
 * ```ts
 * const { messages, addMessage, clearMessages } = useWebSocketMessages()
 * ```
 */
export function useWebSocketMessages() {
  const chatStore = useChatStore()

  const messages = computed(() => chatStore.messages)
  const latestMessage = computed(() => chatStore.latestMessage)
  const messageCount = computed(() => chatStore.messages.length)

  const addMessage = (text: string, isUser = true) => {
    return chatStore.addMessage(text, isUser)
  }

  const clearMessages = () => {
    chatStore.clearMessages()
  }

  return {
    messages,
    latestMessage,
    messageCount,
    addMessage,
    clearMessages
  }
}

/**
 * WebSocket audio composable
 * Provides reactive access to audio state
 *
 * @example
 * ```ts
 * const { isSpeaking, isListening, emotion } = useWebSocketAudio()
 * ```
 */
export function useWebSocketAudio() {
  const chatStore = useChatStore()

  const isSpeaking = computed(() => chatStore.isSpeaking)
  const isListening = computed(() => chatStore.isListening)
  const currentEmotion = computed(() => chatStore.currentEmotion)
  const currentTTSText = computed(() => chatStore.currentTTSText)

  return {
    isSpeaking,
    isListening,
    currentEmotion,
    currentTTSText
  }
}

/**
 * WebSocket connection watcher composable
 * Monitors connection state changes
 *
 * @example
 * ```ts
 * useWebSocketWatcher({
 *   onConnected: () => console.log('Connected!'),
 *   onDisconnected: () => console.log('Disconnected!'),
 *   onError: (error) => console.error('Error:', error)
 * })
 * ```
 */
export function useWebSocketWatcher(callbacks: {
  onConnected?: () => void
  onDisconnected?: () => void
  onReconnecting?: () => void
  onError?: () => void
}) {
  const chatStore = useChatStore()

  // Watch connection state changes
  watch(
    () => chatStore.connectionState,
    (newState, oldState) => {
      console.log(`[useWebSocketWatcher] State changed: ${oldState} → ${newState}`)

      switch (newState) {
        case 'connected':
          callbacks.onConnected?.()
          break
        case 'disconnected':
          callbacks.onDisconnected?.()
          break
        case 'reconnecting':
          callbacks.onReconnecting?.()
          break
        case 'error':
          callbacks.onError?.()
          break
      }
    }
  )

  return {
    stopWatching: () => {
      // Watcher is automatically stopped on component unmount
    }
  }
}
