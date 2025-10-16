/**
 * Socket.IO Protocol Type Definitions
 * Based on Websocket连接.md specification, migrated to Socket.IO
 */

import type { Socket } from 'socket.io-client'

// Audio parameters configuration
export interface AudioParams {
  format: 'opus'
  sample_rate: number
  channels: number
  frame_duration: number
}

// Hello message types
export interface HelloMessage {
  type: 'hello'
  version?: number
  transport: 'socketio'
  features?: {
    mcp: boolean
  }
  audio_params: AudioParams
}

// Listen modes
export type ListenMode = 'auto' | 'manual' | 'realtime'

// Listen state
export type ListenState = 'start' | 'stop' | 'detect'

// Listen message
export interface ListenMessage {
  session_id: string
  type: 'listen'
  state: ListenState
  mode?: ListenMode
  text?: string // For wake word detection
}

// TTS state
export type TTSState = 'start' | 'stop' | 'sentence_start'

// TTS message
export interface TTSMessage {
  type: 'tts'
  state: TTSState
  text?: string // Only present in sentence_start
}

// Abort message
export interface AbortMessage {
  session_id: string
  type: 'abort'
  reason?: string
}

// MCP message
export interface MCPMessage {
  session_id: string
  type: 'mcp'
  payload: unknown
}

// LLM emotion message
export interface LLMMessage {
  type: 'llm'
  emotion: string
}

// Union type for all message types
export type WebsocketMessage =
  | HelloMessage
  | ListenMessage
  | TTSMessage
  | AbortMessage
  | MCPMessage
  | LLMMessage

// Socket.IO connection configuration
export interface WebsocketConfig {
  url: string
  accessToken: string
  deviceId: string
  clientId: string
  protocolVersion: number
  reconnect: boolean
  reconnectInterval: number
  reconnectMaxAttempts: number
  // Socket.IO specific options
  path?: string
  transports?: ('websocket' | 'polling')[]
}

// Connection state
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

// Event handlers
export interface WebsocketEventHandlers {
  onConnected?: () => void
  onDisconnected?: () => void
  onHello?: (message: HelloMessage) => void
  onTTS?: (message: TTSMessage) => void
  onLLM?: (message: LLMMessage) => void
  onMCP?: (message: MCPMessage) => void
  onAudioData?: (data: ArrayBuffer) => void
  onError?: (error: Error) => void
}

// Socket.IO instance type export
export type SocketInstance = Socket

// Audio recording configuration
export interface AudioRecordingConfig {
  sampleRate: number
  channels: number
  frameDuration: number
  format: 'opus'
}

// Session information
export interface SessionInfo {
  sessionId: string
  startTime: Date
  messageCount: number
  audioBytesSent: number
  audioBytesReceived: number
}
