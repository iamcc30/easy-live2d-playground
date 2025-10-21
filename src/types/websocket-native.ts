/**
 * Native WebSocket Protocol Type Definitions
 *
 * IMPORTANT: This protocol requires server-side changes!
 * Server must implement the message routing described below.
 */

// Audio parameters configuration
export interface AudioParams {
  format: 'opus'
  sample_rate: number
  channels: number
  frame_duration: number
}

// Base message interface
export interface BaseMessage {
  type: string
  timestamp?: number
}

// Hello message types
export interface HelloMessage extends BaseMessage {
  type: 'hello'
  version?: number
  transport: 'websocket'
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
export interface ListenMessage extends BaseMessage {
  session_id: string
  type: 'listen'
  state: ListenState
  mode?: ListenMode
  text?: string // For wake word detection
}

// TTS state
export type TTSState = 'start' | 'stop' | 'sentence_start'

// TTS message
export interface TTSMessage extends BaseMessage {
  type: 'tts'
  state: TTSState
  text?: string // Only present in sentence_start
}

// Abort message
export interface AbortMessage extends BaseMessage {
  session_id: string
  type: 'abort'
  reason?: string
}

// MCP message
export interface MCPMessage extends BaseMessage {
  session_id: string
  type: 'mcp'
  payload: unknown
}

// LLM emotion message
export interface LLMMessage extends BaseMessage {
  type: 'llm'
  emotion: string
}

// Ping/Pong for heartbeat
export interface PingMessage extends BaseMessage {
  type: 'ping'
  timestamp: number
}

export interface PongMessage extends BaseMessage {
  type: 'pong'
  timestamp: number
}

// Audio data wrapper (for binary data identification)
export interface AudioDataMessage extends BaseMessage {
  type: 'audio'
  data: ArrayBuffer
}

// Union type for all message types
export type WebsocketMessage =
  | HelloMessage
  | ListenMessage
  | TTSMessage
  | AbortMessage
  | MCPMessage
  | LLMMessage
  | PingMessage
  | PongMessage

// Native WebSocket connection configuration
export interface WebsocketConfig {
  url: string
  accessToken: string
  deviceId: string
  clientId: string
  protocolVersion: number
  reconnect: boolean
  reconnectInterval: number
  reconnectMaxAttempts: number
  // Native WebSocket specific options
  protocols?: string[]
  binaryType?: 'blob' | 'arraybuffer'
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

// Native WebSocket instance type
export type SocketInstance = WebSocket

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

// Message envelope for distinguishing text and binary messages
export interface MessageEnvelope {
  isText: boolean
  data: string | ArrayBuffer
  timestamp: number
}
